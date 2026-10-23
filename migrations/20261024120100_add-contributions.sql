-- Aportes voluntarios con Mercado Pago Checkout Pro. Aditiva: se aplica antes del deploy y convive con
-- el código viejo. Lo que el código viejo todavía usa queda como compatibilidad hasta 20261024120200:
-- claim/finish_subscription_webhook_event son wrappers de las funciones nuevas y subscription_webhook_events
-- es una vista de solo lectura (la lee /api/cron/failure-alerts cada 15 minutos).
-- Idempotente: se puede volver a correr sin efectos.

-- Importes sugeridos. Solo los ve el dueño logueado (la landing es estática y no los lee).
create table if not exists public.contribution_options (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{2,30}$'),
  label text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'ARS' check (currency = 'ARS'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.contribution_options enable row level security;
revoke all on public.contribution_options from public, anon, authenticated;
grant select (code, label, amount_cents, currency, sort_order) on public.contribution_options to authenticated;

drop policy if exists "Active contribution options are readable" on public.contribution_options;
create policy "Active contribution options are readable"
  on public.contribution_options for select
  to authenticated
  using (is_active);

insert into public.contribution_options (code, label, amount_cents, sort_order) values
  ('small', '$5.000', 500000, 10),
  ('medium', '$10.000', 1000000, 20),
  ('large', '$20.000', 2000000, 30)
on conflict (code) do nothing;

-- Un aporte por intento de checkout. external_reference es el id: el webhook encuentra la fila con él.
-- Las escrituras son solo con la service key (checkout y webhook); el dueño lee los suyos.
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents between 100000 and 50000000),
  currency text not null default 'ARS' check (currency = 'ARS'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'refunded', 'charged_back')),
  provider text not null default 'mercadopago' check (provider = 'mercadopago'),
  provider_preference_id text,
  provider_payment_id text unique,
  external_reference text not null unique,
  payer_email text,
  option_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  constraint contributions_external_reference_is_id check (external_reference = id::text)
);

create index if not exists contributions_business_created_idx
  on public.contributions(business_id, created_at desc);
create index if not exists contributions_user_id_idx
  on public.contributions(user_id);

drop trigger if exists contributions_updated_at on public.contributions;
create trigger contributions_updated_at before update on public.contributions
  for each row execute function public.set_updated_at();

alter table public.contributions enable row level security;
revoke all on public.contributions from public, anon, authenticated;
grant select (id, business_id, amount_cents, currency, status, option_code, created_at, approved_at)
  on public.contributions to authenticated;

drop policy if exists "owners read own contributions" on public.contributions;
create policy "owners read own contributions"
  on public.contributions for select
  to authenticated
  using (public.user_owns_business(business_id));

-- Idempotencia de webhooks para cualquier evento de Mercado Pago, no solo suscripciones.
-- Se renombran tabla, constraints e índice para que un branch renombrado y uno creado de cero queden iguales.
do $$
begin
  if to_regclass('public.mercadopago_webhook_events') is null
    and exists (
      select 1 from pg_class
      where oid = to_regclass('public.subscription_webhook_events') and relkind = 'r'
    ) then
    alter table public.subscription_webhook_events rename to mercadopago_webhook_events;
  end if;
end;
$$;

do $$
declare
  v_suffix text;
begin
  if to_regclass('public.mercadopago_webhook_events') is null then
    return;
  end if;
  foreach v_suffix in array array['pkey', 'event_key_key', 'status_check', 'attempt_count_check'] loop
    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.mercadopago_webhook_events'::regclass
        and conname = 'subscription_webhook_events_' || v_suffix
    ) then
      execute format(
        'alter table public.mercadopago_webhook_events rename constraint %I to %I',
        'subscription_webhook_events_' || v_suffix,
        'mercadopago_webhook_events_' || v_suffix
      );
    end if;
  end loop;
end;
$$;

alter index if exists public.subscription_webhook_events_status_created_idx
  rename to mercadopago_webhook_events_status_created_idx;

-- Para branches que nunca tuvieron la tabla de suscripciones (misma definición que 20260921001500).
create table if not exists public.mercadopago_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text,
  action text,
  resource_id text,
  request_id text,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed', 'ignored')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  error_message text,
  lease_expires_at timestamptz not null default (now() + interval '2 minutes'),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mercadopago_webhook_events_status_created_idx
  on public.mercadopago_webhook_events(status, created_at desc);

alter table public.mercadopago_webhook_events enable row level security;
revoke all on public.mercadopago_webhook_events from public, anon, authenticated;

create or replace function public.claim_mercadopago_webhook_event(
  p_event_key text,
  p_event_type text,
  p_action text,
  p_resource_id text,
  p_request_id text
)
returns table(event_id uuid, claim_state text)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_existing public.mercadopago_webhook_events%rowtype;
begin
  select * into v_existing
  from public.mercadopago_webhook_events
  where event_key = p_event_key
  for update;

  if found then
    if v_existing.status in ('processed', 'ignored') then
      return query select v_existing.id, 'completed'::text;
      return;
    end if;
    if v_existing.status = 'processing' and v_existing.lease_expires_at > now() then
      return query select v_existing.id, 'processing'::text;
      return;
    end if;

    update public.mercadopago_webhook_events
    set status = 'processing', attempt_count = attempt_count + 1,
        error_message = null, lease_expires_at = now() + interval '2 minutes', updated_at = now()
    where id = v_existing.id;
    return query select v_existing.id, 'claimed'::text;
    return;
  end if;

  insert into public.mercadopago_webhook_events(
    event_key, event_type, action, resource_id, request_id
  ) values (
    p_event_key, p_event_type, p_action, p_resource_id, p_request_id
  ) returning id into event_id;

  claim_state := 'claimed';
  return next;
exception
  when unique_violation then
    return query select null::uuid, 'processing'::text;
end;
$$;

create or replace function public.finish_mercadopago_webhook_event(
  p_event_id uuid,
  p_status text,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_status not in ('processed', 'failed', 'ignored') then
    raise exception 'Estado de webhook invalido';
  end if;

  update public.mercadopago_webhook_events
  set status = p_status,
      error_message = left(p_error_message, 500),
      processed_at = case when p_status in ('processed', 'ignored') then now() else null end,
      updated_at = now()
  where id = p_event_id;
end;
$$;

-- Compatibilidad con el código desplegado hasta el release; 20261024120200 los elimina.
create or replace function public.claim_subscription_webhook_event(
  p_event_key text,
  p_event_type text,
  p_action text,
  p_resource_id text,
  p_request_id text
)
returns table(event_id uuid, claim_state text)
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select * from public.claim_mercadopago_webhook_event(p_event_key, p_event_type, p_action, p_resource_id, p_request_id);
$$;

create or replace function public.finish_subscription_webhook_event(
  p_event_id uuid,
  p_status text,
  p_error_message text default null
)
returns void
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.finish_mercadopago_webhook_event(p_event_id, p_status, p_error_message);
$$;

do $$
begin
  if to_regclass('public.subscription_webhook_events') is null then
    create view public.subscription_webhook_events with (security_invoker = true) as
      select * from public.mercadopago_webhook_events;
  end if;
end;
$$;

revoke all on public.subscription_webhook_events from public, anon, authenticated;

revoke execute on function public.claim_mercadopago_webhook_event(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.finish_mercadopago_webhook_event(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.claim_subscription_webhook_event(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.finish_subscription_webhook_event(uuid, text, text) from public, anon, authenticated;

-- El email de agradecimiento sale por el outbox. Se reemplaza el CHECK buscándolo por su definición,
-- así no depende del nombre que tenga en cada base.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.email_outbox'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%event_type%'
  loop
    execute format('alter table public.email_outbox drop constraint %I', v_name);
  end loop;
end;
$$;

alter table public.email_outbox add constraint email_outbox_event_type_check check (event_type in (
  'welcome',
  'booking_created',
  'deposit_confirmed',
  'appointment_cancelled',
  'appointment_rescheduled',
  'appointment_reminder',
  'contribution_received'
));

-- Aplica el estado de un pago de Mercado Pago a su aporte. Solo la service key (webhook).
-- Devuelve applied | duplicate | ignored_other_payment.
create or replace function public.apply_contribution_payment(
  p_contribution_id uuid,
  p_provider_payment_id text,
  p_status text,
  p_amount_cents integer,
  p_currency text,
  p_payer_email text default null,
  p_approved_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_contribution public.contributions%rowtype;
  v_status text;
  v_business_name text;
  v_owner_id uuid;
  v_owner_email text;
begin
  select * into v_contribution
  from public.contributions
  where id = p_contribution_id
  for update;

  if not found then
    raise exception 'Aporte no encontrado';
  end if;

  if nullif(btrim(p_provider_payment_id), '') is null then
    raise exception 'Pago de aporte invalido';
  end if;

  if p_currency is distinct from 'ARS' or p_amount_cents is distinct from v_contribution.amount_cents then
    raise exception 'Importe de aporte invalido';
  end if;

  v_status := case p_status
    when 'approved' then 'approved'
    when 'rejected' then 'rejected'
    when 'cancelled' then 'rejected'
    when 'refunded' then 'refunded'
    when 'charged_back' then 'charged_back'
    when 'in_process' then 'pending'
    when 'pending' then 'pending'
  end;

  if v_status is null then
    raise exception 'Estado de pago invalido: %', p_status;
  end if;

  -- Reembolsos y contracargos son terminales.
  if v_contribution.status in ('refunded', 'charged_back') then
    return 'duplicate';
  end if;

  -- Una preferencia de Checkout Pro se puede pagar más de una vez. Una vez aprobado, el aporte queda
  -- atado a ese pago: los eventos de otros pagos (incluidos sus reembolsos) no lo modifican.
  if v_contribution.status = 'approved'
    and v_contribution.provider_payment_id is distinct from p_provider_payment_id then
    return 'ignored_other_payment';
  end if;

  if v_contribution.status = v_status
    and v_contribution.provider_payment_id is not distinct from p_provider_payment_id then
    return 'duplicate';
  end if;

  -- Un pago aprobado solo puede pasar a reembolsado o contracargo; un evento viejo no lo degrada.
  if v_contribution.status = 'approved' and v_status not in ('refunded', 'charged_back') then
    return 'duplicate';
  end if;

  update public.contributions
  set status = v_status,
      provider_payment_id = p_provider_payment_id,
      payer_email = coalesce(nullif(lower(btrim(p_payer_email)), ''), payer_email),
      approved_at = case when v_status = 'approved' then coalesce(p_approved_at, now()) else approved_at end,
      updated_at = now()
  where id = v_contribution.id;

  if v_status = 'approved' then
    select b.name, b.owner_id, lower(u.email)
    into v_business_name, v_owner_id, v_owner_email
    from public.businesses b
    join auth.users u on u.id = b.owner_id
    where b.id = v_contribution.business_id;

    if nullif(v_owner_email, '') is not null then
      insert into public.email_outbox (
        event_type,
        recipient_kind,
        recipient_email,
        user_id,
        payload,
        idempotency_key
      ) values (
        'contribution_received',
        'user',
        v_owner_email,
        v_owner_id,
        jsonb_build_object(
          'amount_cents', v_contribution.amount_cents,
          'currency', v_contribution.currency,
          'business_name', v_business_name,
          'contribution_id', v_contribution.id
        ),
        'contribution_received:' || v_contribution.id::text
      )
      on conflict (idempotency_key) do nothing;
    end if;
  end if;

  return 'applied';
end;
$$;

revoke execute on function public.apply_contribution_payment(uuid, text, text, integer, text, text, timestamptz)
  from public, anon, authenticated;
