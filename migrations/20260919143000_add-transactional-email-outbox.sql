create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'welcome',
    'booking_created',
    'deposit_confirmed',
    'appointment_cancelled',
    'appointment_rescheduled',
    'appointment_reminder'
  )),
  recipient_kind text not null check (recipient_kind in ('user', 'client', 'owner')),
  recipient_email text not null,
  reply_to text,
  appointment_id uuid references public.appointments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'retry', 'sent', 'delivered', 'failed',
    'cancelled', 'bounced', 'complained', 'suppressed'
  )),
  scheduled_for timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  locked_at timestamptz,
  provider_id text,
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_outbox_ready_idx
  on public.email_outbox (next_attempt_at, scheduled_for)
  where status in ('pending', 'retry');

create index email_outbox_provider_idx
  on public.email_outbox (provider_id)
  where provider_id is not null;

create table public.email_webhook_events (
  event_key text primary key,
  provider_id text not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.email_outbox enable row level security;
alter table public.email_webhook_events enable row level security;

revoke all on table public.email_outbox from anon, authenticated;
revoke all on table public.email_webhook_events from anon, authenticated;

create or replace function public.build_appointment_email_payload(p_appointment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select jsonb_build_object(
    'appointmentId', a.id,
    'status', a.status,
    'startsAt', a.starts_at,
    'endsAt', a.ends_at,
    'depositAmountCents', a.deposit_amount_cents,
    'depositExpiresAt', a.deposit_expires_at,
    'depositConfirmedAt', a.deposit_confirmed_at,
    'cancellationReason', a.cancellation_reason,
    'clientMessage', a.client_message,
    'client', jsonb_build_object(
      'name', c.name,
      'email', c.email,
      'phone', c.phone
    ),
    'service', jsonb_build_object(
      'name', s.name,
      'description', s.description,
      'durationMinutes', s.duration_minutes,
      'priceCents', s.price_cents,
      'depositType', s.deposit_type
    ),
    'business', jsonb_build_object(
      'name', b.name,
      'slug', b.slug,
      'timezone', b.timezone,
      'currency', b.currency,
      'logoUrl', b.logo_url,
      'publicAddress', b.public_address,
      'serviceMode', b.service_mode,
      'virtualPlatforms', b.virtual_platforms,
      'paymentAlias', b.payment_alias,
      'paymentCbu', b.payment_cbu,
      'paymentInstructions', b.payment_instructions,
      'notificationEmail', n.email
    )
  )
  from public.appointments a
  join public.clients c on c.id = a.client_id
  join public.services s on s.id = a.service_id
  join public.businesses b on b.id = a.business_id
  left join public.business_notification_settings n on n.business_id = b.id
  where a.id = p_appointment_id;
$$;

create or replace function public.enqueue_appointment_email(
  p_appointment_id uuid,
  p_event_type text,
  p_recipient_kind text,
  p_idempotency_key text,
  p_scheduled_for timestamptz default now(),
  p_extra_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_payload jsonb;
  v_client_email text;
  v_owner_email text;
  v_recipient_email text;
  v_reply_to text;
begin
  v_payload := public.build_appointment_email_payload(p_appointment_id) || coalesce(p_extra_payload, '{}'::jsonb);
  v_client_email := nullif(btrim(v_payload #>> '{client,email}'), '');
  v_owner_email := nullif(btrim(v_payload #>> '{business,notificationEmail}'), '');

  if p_recipient_kind = 'client' then
    v_recipient_email := v_client_email;
    v_reply_to := v_owner_email;
  elsif p_recipient_kind = 'owner' then
    v_recipient_email := v_owner_email;
    v_reply_to := v_client_email;
  else
    raise exception 'Destinatario de turno invalido';
  end if;

  if v_recipient_email is null then
    return;
  end if;

  insert into public.email_outbox (
    event_type,
    recipient_kind,
    recipient_email,
    reply_to,
    appointment_id,
    payload,
    idempotency_key,
    scheduled_for,
    next_attempt_at
  ) values (
    p_event_type,
    p_recipient_kind,
    lower(v_recipient_email),
    lower(v_reply_to),
    p_appointment_id,
    v_payload,
    p_idempotency_key,
    p_scheduled_for,
    p_scheduled_for
  )
  on conflict (idempotency_key) do nothing;
end;
$$;

create or replace function public.queue_appointment_email_events()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_revision text;
  v_reminder_at timestamptz;
begin
  if tg_op = 'INSERT' then
    perform public.enqueue_appointment_email(
      new.id, 'booking_created', 'client',
      'booking-created:' || new.id::text || ':client'
    );
    perform public.enqueue_appointment_email(
      new.id, 'booking_created', 'owner',
      'booking-created:' || new.id::text || ':owner'
    );

    if new.status = 'confirmed' then
      v_reminder_at := new.starts_at - interval '24 hours';
      if v_reminder_at > now() then
        perform public.enqueue_appointment_email(
          new.id, 'appointment_reminder', 'client',
          'appointment-reminder:' || new.id::text || ':' || extract(epoch from new.starts_at)::bigint::text,
          v_reminder_at
        );
      end if;
    end if;
    return new;
  end if;

  if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    update public.email_outbox
    set status = 'cancelled', updated_at = now()
    where appointment_id = new.id
      and event_type = 'appointment_reminder'
      and status in ('pending', 'retry');

    v_revision := md5(old.starts_at::text || ':' || old.ends_at::text || '>' || new.starts_at::text || ':' || new.ends_at::text);
    perform public.enqueue_appointment_email(
      new.id, 'appointment_rescheduled', 'client',
      'appointment-rescheduled:' || new.id::text || ':client:' || v_revision,
      now(),
      jsonb_build_object('previousStartsAt', old.starts_at, 'previousEndsAt', old.ends_at)
    );
    perform public.enqueue_appointment_email(
      new.id, 'appointment_rescheduled', 'owner',
      'appointment-rescheduled:' || new.id::text || ':owner:' || v_revision,
      now(),
      jsonb_build_object('previousStartsAt', old.starts_at, 'previousEndsAt', old.ends_at)
    );

    if new.status = 'confirmed' then
      v_reminder_at := new.starts_at - interval '24 hours';
      if v_reminder_at > now() then
        perform public.enqueue_appointment_email(
          new.id, 'appointment_reminder', 'client',
          'appointment-reminder:' || new.id::text || ':' || extract(epoch from new.starts_at)::bigint::text,
          v_reminder_at
        );
      end if;
    end if;
  end if;

  if old.status = 'pending_payment' and new.status = 'confirmed' then
    perform public.enqueue_appointment_email(
      new.id, 'deposit_confirmed', 'client',
      'deposit-confirmed:' || new.id::text || ':client'
    );

    if new.starts_at - interval '24 hours' > now() then
      perform public.enqueue_appointment_email(
        new.id, 'appointment_reminder', 'client',
        'appointment-reminder:' || new.id::text || ':' || extract(epoch from new.starts_at)::bigint::text,
        new.starts_at - interval '24 hours'
      );
    end if;
  end if;

  if old.status is distinct from new.status and new.status = 'cancelled' then
    update public.email_outbox
    set status = 'cancelled', updated_at = now()
    where appointment_id = new.id
      and event_type = 'appointment_reminder'
      and status in ('pending', 'retry');

    v_revision := md5(coalesce(new.cancellation_reason, '') || ':' || new.updated_at::text);
    perform public.enqueue_appointment_email(
      new.id, 'appointment_cancelled', 'client',
      'appointment-cancelled:' || new.id::text || ':client:' || v_revision
    );
    perform public.enqueue_appointment_email(
      new.id, 'appointment_cancelled', 'owner',
      'appointment-cancelled:' || new.id::text || ':owner:' || v_revision
    );
  end if;

  return new;
end;
$$;

create or replace function public.set_new_appointment_deposit_expiration()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.deposit_amount_cents > 0 and new.deposit_expires_at is null then
    new.deposit_expires_at := least(now() + interval '2 hours', new.starts_at);
  end if;
  return new;
end;
$$;

create trigger set_new_appointment_deposit_expiration
before insert on public.appointments
for each row execute function public.set_new_appointment_deposit_expiration();

create trigger queue_appointment_email_events
after insert or update of status, starts_at, ends_at on public.appointments
for each row execute function public.queue_appointment_email_events();

create or replace function public.guard_pending_deposit_confirmation()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if old.status = 'pending_payment'
    and new.status = 'confirmed'
    and old.deposit_amount_cents > 0
    and (
      new.deposit_confirmed_at is null
      or new.deposit_confirmed_by is distinct from auth.uid()
    ) then
    raise exception 'Confirmá la seña con la acción correspondiente';
  end if;
  return new;
end;
$$;

create trigger guard_pending_deposit_confirmation
before update of status on public.appointments
for each row execute function public.guard_pending_deposit_confirmation();

create or replace function public.confirm_appointment_deposit(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_appointment public.appointments%rowtype;
begin
  select * into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
    and a.status = 'pending_payment'
    and a.deposit_amount_cents > 0
    and public.user_owns_business(a.business_id)
  for update;

  if not found then
    raise exception 'Reserva pendiente no encontrada';
  end if;

  if v_appointment.deposit_expires_at is not null and v_appointment.deposit_expires_at <= now() then
    update public.appointments
    set status = 'cancelled',
        cancellation_reason = 'Seña no confirmada dentro del plazo',
        updated_at = now()
    where id = p_appointment_id;
    return;
  end if;

  update public.appointments
  set status = 'confirmed',
      deposit_confirmed_at = now(),
      deposit_confirmed_by = auth.uid(),
      updated_at = now()
  where id = p_appointment_id;
end;
$$;

create or replace function public.queue_citadely_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if coalesce(new.email_verified, false)
    and (tg_op = 'INSERT' or not coalesce(old.email_verified, false)) then
    insert into public.email_outbox (
      event_type,
      recipient_kind,
      recipient_email,
      user_id,
      payload,
      idempotency_key
    ) values (
      'welcome',
      'user',
      lower(new.email),
      new.id,
      jsonb_build_object(
        'name', coalesce(nullif(new.profile->>'name', ''), split_part(new.email, '@', 1)),
        'email', new.email
      ),
      'welcome:' || new.id::text
    )
    on conflict (idempotency_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger queue_citadely_welcome_email
after insert or update of email_verified on auth.users
for each row execute function public.queue_citadely_welcome_email();

create or replace function public.claim_email_outbox(p_limit integer default 20)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  return query
  with candidates as (
    select id
    from public.email_outbox
    where (
      status in ('pending', 'retry')
      or (status = 'processing' and locked_at < now() - interval '10 minutes')
    )
      and scheduled_for <= now()
      and next_attempt_at <= now()
    order by scheduled_for, created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.email_outbox o
  set status = 'processing',
      locked_at = now(),
      attempts = o.attempts + 1,
      updated_at = now()
  from candidates c
  where o.id = c.id
  returning o.*;
end;
$$;

create or replace function public.complete_email_outbox(p_id uuid, p_provider_id text)
returns void
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  update public.email_outbox
  set status = 'sent',
      provider_id = p_provider_id,
      sent_at = now(),
      locked_at = null,
      last_error = null,
      updated_at = now()
  where id = p_id and status = 'processing';
$$;

create or replace function public.retry_email_outbox(p_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  update public.email_outbox
  set status = case when attempts >= max_attempts then 'failed' else 'retry' end,
      next_attempt_at = case
        when attempts >= max_attempts then next_attempt_at
        else now() + make_interval(mins => least(60, (power(2, attempts))::integer))
      end,
      locked_at = null,
      last_error = left(coalesce(p_error, 'Error desconocido'), 2000),
      updated_at = now()
  where id = p_id and status = 'processing';
end;
$$;

create or replace function public.record_email_webhook(
  p_event_key text,
  p_provider_id text,
  p_event_type text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_rows integer;
  v_status text;
begin
  insert into public.email_webhook_events (event_key, provider_id, event_type, payload)
  values (p_event_key, p_provider_id, p_event_type, p_payload)
  on conflict (event_key) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return false;
  end if;

  v_status := case p_event_type
    when 'email.delivered' then 'delivered'
    when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained'
    when 'email.suppressed' then 'suppressed'
    when 'email.failed' then 'failed'
    else null
  end;

  if v_status is not null then
    update public.email_outbox
    set status = v_status,
        delivered_at = case when v_status = 'delivered' then now() else delivered_at end,
        updated_at = now()
    where provider_id = p_provider_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.build_appointment_email_payload(uuid) from public, anon, authenticated;
revoke execute on function public.enqueue_appointment_email(uuid, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.claim_email_outbox(integer) from public, anon, authenticated;
revoke execute on function public.complete_email_outbox(uuid, text) from public, anon, authenticated;
revoke execute on function public.retry_email_outbox(uuid, text) from public, anon, authenticated;
revoke execute on function public.record_email_webhook(text, text, text, jsonb) from public, anon, authenticated;

revoke execute on function public.confirm_appointment_deposit(uuid) from public, anon;
grant execute on function public.confirm_appointment_deposit(uuid) to authenticated;

-- New pre-reservations get two hours to confirm the transfer, never extending
-- beyond the appointment itself. Existing expiration timestamps are untouched.
create or replace function public.create_public_booking(
  p_business_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_email text,
  p_client_phone text default null,
  p_client_message text default null
)
returns table (
  appointment_id uuid,
  client_id uuid,
  payment_id uuid,
  status text,
  amount_cents integer,
  deposit_expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_service public.services%rowtype;
  v_ends_at timestamptz;
  v_amount_cents integer;
  v_status text;
  v_client_id uuid;
  v_appointment_id uuid;
  v_deposit_expires_at timestamptz;
begin
  if p_business_id is null or p_service_id is null or p_starts_at is null then
    raise exception 'Datos de reserva incompletos';
  end if;
  if p_client_name is null or char_length(btrim(p_client_name)) not between 1 and 120 then
    raise exception 'Nombre invalido';
  end if;
  if p_client_email is null
    or char_length(btrim(p_client_email)) not between 3 and 254
    or position('@' in btrim(p_client_email)) <= 1 then
    raise exception 'Email invalido';
  end if;
  if p_client_phone is not null and char_length(btrim(p_client_phone)) not between 1 and 40 then
    raise exception 'Telefono invalido';
  end if;
  if p_client_message is not null and char_length(p_client_message) > 2000 then
    raise exception 'Mensaje demasiado largo';
  end if;
  if not public.business_has_booking_access(p_business_id) then
    raise exception 'Negocio no disponible para reservas';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_business_id::text, 0));

  select * into v_service
  from public.services
  where id = p_service_id and business_id = p_business_id and is_active = true;
  if not found then raise exception 'Servicio no disponible'; end if;

  v_ends_at := p_starts_at + pg_catalog.make_interval(mins => v_service.duration_minutes);
  if p_starts_at <= pg_catalog.now() then raise exception 'El horario ya no esta disponible'; end if;

  if not exists (
    select 1 from public.service_availability_slots slot
    where slot.business_id = p_business_id
      and slot.service_id = p_service_id
      and slot.is_active = true
      and slot.starts_at = p_starts_at
      and slot.ends_at = v_ends_at
  ) then raise exception 'El horario seleccionado no esta habilitado'; end if;

  if exists (
    select 1 from public.appointments a
    where a.business_id = p_business_id
      and a.status <> 'cancelled'
      and p_starts_at < a.ends_at
      and v_ends_at > a.starts_at
  ) then raise exception 'El horario seleccionado ya esta ocupado'; end if;

  v_amount_cents := case v_service.deposit_type
    when 'full' then v_service.price_cents
    when 'deposit' then v_service.deposit_value_cents
    else 0
  end;
  v_status := case when v_amount_cents > 0 then 'pending_payment' else 'confirmed' end;
  v_deposit_expires_at := case
    when v_amount_cents > 0 then least(pg_catalog.now() + interval '2 hours', p_starts_at)
    else null
  end;

  insert into public.clients (business_id, name, email, phone)
  values (p_business_id, btrim(p_client_name), lower(btrim(p_client_email)), nullif(btrim(p_client_phone), ''))
  returning id into v_client_id;

  insert into public.appointments (
    business_id, client_id, service_id, starts_at, ends_at, status, source,
    client_message, deposit_amount_cents, deposit_expires_at
  ) values (
    p_business_id, v_client_id, p_service_id, p_starts_at, v_ends_at, v_status,
    'public_booking', nullif(btrim(p_client_message), ''), v_amount_cents, v_deposit_expires_at
  ) returning id into v_appointment_id;

  return query select v_appointment_id, v_client_id, null::uuid, v_status, v_amount_cents, v_deposit_expires_at;
end;
$$;

revoke execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text) from public;
grant execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text) to anon, authenticated;
