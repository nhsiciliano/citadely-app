alter table public.businesses
  add column if not exists payment_alias text,
  add column if not exists payment_cbu text,
  add column if not exists payment_instructions text,
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '7 days'),
  add column if not exists subscription_status text not null default 'trialing',
  add column if not exists subscription_provider text,
  add column if not exists subscription_external_id text,
  add column if not exists subscription_checkout_url text,
  add column if not exists subscription_current_period_end timestamptz;

alter table public.appointments
  add column if not exists deposit_amount_cents integer not null default 0,
  add column if not exists deposit_expires_at timestamptz,
  add column if not exists deposit_confirmed_at timestamptz,
  add column if not exists deposit_confirmed_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_subscription_status_check'
  ) then
    alter table public.businesses
      add constraint businesses_subscription_status_check
      check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled', 'expired'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_deposit_amount_nonnegative'
  ) then
    alter table public.appointments
      add constraint appointments_deposit_amount_nonnegative
      check (deposit_amount_cents >= 0);
  end if;
end $$;

create index if not exists appointments_pending_deposit_expiry_idx
  on public.appointments(deposit_expires_at)
  where status = 'pending_payment';

create index if not exists businesses_subscription_external_id_idx
  on public.businesses(subscription_external_id)
  where subscription_external_id is not null;

create or replace function public.business_has_booking_access(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = target_business_id
      and b.is_public = true
      and (
        b.subscription_status = 'active'
        or (b.subscription_status = 'trialing' and b.trial_ends_at > now())
      )
  );
$$;

drop function if exists public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text);

create or replace function public.create_public_booking(
  p_business_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_email text,
  p_client_phone text default null,
  p_client_message text default null
)
returns table(
  appointment_id uuid,
  client_id uuid,
  payment_id uuid,
  status text,
  amount_cents integer,
  deposit_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
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
  if not public.business_has_booking_access(p_business_id) then
    raise exception 'Negocio no disponible para reservas';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id
    and business_id = p_business_id
    and is_active = true;

  if not found then
    raise exception 'Servicio no disponible';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);

  if p_starts_at <= now() then
    raise exception 'El horario ya no esta disponible';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.business_id = p_business_id
      and a.status <> 'cancelled'
      and p_starts_at < a.ends_at
      and v_ends_at > a.starts_at
  ) then
    raise exception 'El horario seleccionado ya esta ocupado';
  end if;

  v_amount_cents := case v_service.deposit_type
    when 'full' then v_service.price_cents
    when 'deposit' then v_service.deposit_value_cents
    else 0
  end;

  v_status := case when v_amount_cents > 0 then 'pending_payment' else 'confirmed' end;
  v_deposit_expires_at := case when v_amount_cents > 0 then now() + interval '30 minutes' else null end;

  insert into public.clients (business_id, name, email, phone)
  values (p_business_id, p_client_name, p_client_email, p_client_phone)
  returning id into v_client_id;

  insert into public.appointments (
    business_id,
    client_id,
    service_id,
    starts_at,
    ends_at,
    status,
    source,
    client_message,
    deposit_amount_cents,
    deposit_expires_at
  )
  values (
    p_business_id,
    v_client_id,
    p_service_id,
    p_starts_at,
    v_ends_at,
    v_status,
    'public_booking',
    p_client_message,
    v_amount_cents,
    v_deposit_expires_at
  )
  returning id into v_appointment_id;

  return query select v_appointment_id, v_client_id, null::uuid, v_status, v_amount_cents, v_deposit_expires_at;
end;
$$;

create or replace function public.confirm_appointment_deposit(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.appointments a
  set
    status = 'confirmed',
    deposit_confirmed_at = now(),
    deposit_confirmed_by = auth.uid(),
    updated_at = now()
  where a.id = p_appointment_id
    and a.status = 'pending_payment'
    and a.deposit_amount_cents > 0
    and public.user_owns_business(a.business_id);

  if not found then
    raise exception 'Reserva pendiente no encontrada';
  end if;
end;
$$;

create or replace function public.cancel_expired_deposit_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.appointments
  set
    status = 'cancelled',
    cancellation_reason = 'Seña no confirmada dentro del plazo',
    updated_at = now()
  where status = 'pending_payment'
    and deposit_amount_cents > 0
    and deposit_expires_at is not null
    and deposit_expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.set_business_subscription_checkout(
  p_business_id uuid,
  p_external_id text,
  p_checkout_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.businesses
  set
    subscription_provider = 'mercadopago',
    subscription_external_id = p_external_id,
    subscription_checkout_url = p_checkout_url,
    updated_at = now()
  where id = p_business_id
    and owner_id = auth.uid();

  if not found then
    raise exception 'Negocio no encontrado';
  end if;
end;
$$;

create or replace function public.sync_business_subscription_status(
  p_external_id text,
  p_status text,
  p_current_period_end timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  v_status := case p_status
    when 'authorized' then 'active'
    when 'active' then 'active'
    when 'paused' then 'past_due'
    when 'pending' then 'past_due'
    when 'cancelled' then 'cancelled'
    else 'past_due'
  end;

  update public.businesses
  set
    subscription_provider = 'mercadopago',
    subscription_status = v_status,
    subscription_current_period_end = coalesce(p_current_period_end, subscription_current_period_end),
    updated_at = now()
  where subscription_external_id = p_external_id;

  if not found then
    raise exception 'Suscripcion no encontrada';
  end if;
end;
$$;

create or replace function public.sync_business_subscription_payment(
  p_business_id uuid,
  p_status text,
  p_current_period_end timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status = 'approved' then
    update public.businesses
    set
      subscription_provider = 'mercadopago',
      subscription_status = 'active',
      subscription_current_period_end = coalesce(p_current_period_end, now() + interval '1 month'),
      updated_at = now()
    where id = p_business_id;
  elsif p_status in ('rejected', 'cancelled', 'refunded') then
    update public.businesses
    set
      subscription_provider = 'mercadopago',
      subscription_status = 'past_due',
      updated_at = now()
    where id = p_business_id
      and subscription_status <> 'active';
  end if;
end;
$$;

grant execute on function public.business_has_booking_access(uuid) to anon, authenticated;
grant execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.confirm_appointment_deposit(uuid) to authenticated;
grant execute on function public.cancel_expired_deposit_bookings() to anon, authenticated;
grant execute on function public.set_business_subscription_checkout(uuid, text, text) to authenticated;
grant execute on function public.sync_business_subscription_status(text, text, timestamptz) to anon, authenticated;
grant execute on function public.sync_business_subscription_payment(uuid, text, timestamptz) to anon, authenticated;
