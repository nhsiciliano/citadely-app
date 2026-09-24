-- Copia de 20260921001500_harden-mercadopago-subscriptions.sql para alinear esta Preview con el esquema de Mercado Pago.
alter table public.businesses
  add column if not exists subscription_cancel_at_period_end boolean not null default false,
  add column if not exists subscription_last_payment_id text,
  add column if not exists subscription_last_payment_status text,
  add column if not exists subscription_last_payment_at timestamptz;

create table if not exists public.subscription_operations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  operation_type text not null check (operation_type in ('select_plan', 'cancel')),
  requested_plan text check (requested_plan is null or requested_plan in ('essential', 'pro')),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  result jsonb not null default '{}'::jsonb,
  error_message text,
  lease_expires_at timestamptz not null default (now() + interval '2 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscription_operations_one_active_business_idx
  on public.subscription_operations(business_id)
  where status = 'processing';

create index if not exists subscription_operations_business_created_idx
  on public.subscription_operations(business_id, created_at desc);

create table if not exists public.subscription_webhook_events (
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

create index if not exists subscription_webhook_events_status_created_idx
  on public.subscription_webhook_events(status, created_at desc);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null default 'mercadopago' check (provider = 'mercadopago'),
  provider_payment_id text not null unique,
  subscription_external_id text not null,
  status text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency = 'ARS'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_payments_business_created_idx
  on public.subscription_payments(business_id, created_at desc);

alter table public.subscription_operations enable row level security;
alter table public.subscription_webhook_events enable row level security;
alter table public.subscription_payments enable row level security;

revoke all on public.subscription_operations from public, anon, authenticated;
revoke all on public.subscription_webhook_events from public, anon, authenticated;
revoke all on public.subscription_payments from public, anon, authenticated;

create or replace function public.claim_subscription_operation(
  p_request_id uuid,
  p_business_id uuid,
  p_operation_type text,
  p_requested_plan text default null
)
returns table(operation_id uuid, claim_state text, operation_result jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_existing public.subscription_operations%rowtype;
begin
  if p_operation_type not in ('select_plan', 'cancel') then
    raise exception 'Operacion de suscripcion invalida';
  end if;
  if p_operation_type = 'select_plan' and p_requested_plan not in ('essential', 'pro') then
    raise exception 'Plan de suscripcion invalido';
  end if;

  select * into v_existing
  from public.subscription_operations
  where request_id = p_request_id;

  if found then
    if v_existing.business_id <> p_business_id
      or v_existing.operation_type <> p_operation_type
      or v_existing.requested_plan is distinct from p_requested_plan then
      raise exception 'La solicitud idempotente no coincide';
    end if;

    if v_existing.status = 'completed' then
      return query select v_existing.id, 'completed'::text, v_existing.result;
      return;
    end if;

    if v_existing.status = 'processing' and v_existing.lease_expires_at > now() then
      return query select v_existing.id, 'processing'::text, v_existing.result;
      return;
    end if;

    update public.subscription_operations
    set status = 'processing', error_message = null,
        lease_expires_at = now() + interval '2 minutes', updated_at = now()
    where id = v_existing.id;
    return query select v_existing.id, 'claimed'::text, '{}'::jsonb;
    return;
  end if;

  update public.subscription_operations
  set status = 'failed', error_message = 'Operacion expirada', updated_at = now()
  where business_id = p_business_id
    and status = 'processing'
    and lease_expires_at <= now();

  if exists (
    select 1 from public.subscription_operations
    where business_id = p_business_id and status = 'processing'
  ) then
    return query select null::uuid, 'busy'::text, '{}'::jsonb;
    return;
  end if;

  insert into public.subscription_operations(request_id, business_id, operation_type, requested_plan)
  values (p_request_id, p_business_id, p_operation_type, p_requested_plan)
  returning id into operation_id;

  claim_state := 'claimed';
  operation_result := '{}'::jsonb;
  return next;
exception
  when unique_violation then
    return query select null::uuid, 'busy'::text, '{}'::jsonb;
end;
$$;

create or replace function public.finish_subscription_operation(
  p_operation_id uuid,
  p_status text,
  p_result jsonb default '{}'::jsonb,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'Estado de operacion invalido';
  end if;

  update public.subscription_operations
  set status = p_status,
      result = coalesce(p_result, '{}'::jsonb),
      error_message = left(p_error_message, 500),
      updated_at = now()
  where id = p_operation_id and status = 'processing';
end;
$$;

create or replace function public.claim_subscription_webhook_event(
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
  v_existing public.subscription_webhook_events%rowtype;
begin
  select * into v_existing
  from public.subscription_webhook_events
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

    update public.subscription_webhook_events
    set status = 'processing', attempt_count = attempt_count + 1,
        error_message = null, lease_expires_at = now() + interval '2 minutes', updated_at = now()
    where id = v_existing.id;
    return query select v_existing.id, 'claimed'::text;
    return;
  end if;

  insert into public.subscription_webhook_events(
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

create or replace function public.finish_subscription_webhook_event(
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

  update public.subscription_webhook_events
  set status = p_status,
      error_message = left(p_error_message, 500),
      processed_at = case when p_status in ('processed', 'ignored') then now() else null end,
      updated_at = now()
  where id = p_event_id;
end;
$$;

create or replace function public.apply_mercadopago_subscription_payment(
  p_business_id uuid,
  p_subscription_external_id text,
  p_provider_payment_id text,
  p_status text,
  p_amount_cents integer,
  p_currency text,
  p_paid_at timestamptz default null,
  p_current_period_end timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_paid_plan text;
  v_previous_status text;
  v_period_end timestamptz;
begin
  select * into v_business
  from public.businesses
  where id = p_business_id
    and subscription_provider = 'mercadopago'
    and subscription_external_id = p_subscription_external_id
  for update;

  if not found then
    raise exception 'Suscripcion no encontrada';
  end if;

  if p_currency <> 'ARS' then
    raise exception 'Moneda de suscripcion invalida';
  end if;

  v_paid_plan := case p_amount_cents
    when 1400000 then 'essential'
    when 1800000 then 'pro'
    else null
  end;

  if v_paid_plan is null
    or (v_paid_plan <> v_business.subscription_plan
      and v_paid_plan is distinct from v_business.pending_subscription_plan) then
    raise exception 'Importe de suscripcion invalido';
  end if;

  select status into v_previous_status
  from public.subscription_payments
  where provider_payment_id = p_provider_payment_id;

  insert into public.subscription_payments(
    business_id, provider_payment_id, subscription_external_id, status,
    amount_cents, currency, paid_at
  ) values (
    p_business_id, p_provider_payment_id, p_subscription_external_id, p_status,
    p_amount_cents, p_currency, p_paid_at
  )
  on conflict (provider_payment_id) do update
  set status = excluded.status,
      paid_at = coalesce(excluded.paid_at, public.subscription_payments.paid_at),
      updated_at = now();

  if p_status = 'approved' and v_previous_status is distinct from 'approved' then
    v_period_end := coalesce(p_current_period_end, coalesce(p_paid_at, now()) + interval '1 month');
    update public.businesses
    set subscription_status = 'active',
        subscription_plan = v_paid_plan,
        pending_subscription_plan = case
          when pending_subscription_plan = v_paid_plan then null
          else pending_subscription_plan
        end,
        subscription_current_period_end = v_period_end,
        subscription_cancel_at_period_end = false,
        subscription_checkout_url = null,
        subscription_last_payment_id = p_provider_payment_id,
        subscription_last_payment_status = p_status,
        subscription_last_payment_at = coalesce(p_paid_at, now()),
        updated_at = now()
    where id = p_business_id;
    return 'applied';
  elsif p_status in ('rejected', 'cancelled') then
    update public.businesses
    set subscription_status = case
          when subscription_current_period_end > now() then 'past_due'
          else 'past_due'
        end,
        subscription_last_payment_id = p_provider_payment_id,
        subscription_last_payment_status = p_status,
        updated_at = now()
    where id = p_business_id;
    return 'past_due';
  elsif p_status in ('refunded', 'charged_back') then
    update public.businesses
    set subscription_status = 'cancelled',
        pending_subscription_plan = null,
        subscription_current_period_end = now(),
        subscription_cancel_at_period_end = false,
        subscription_checkout_url = null,
        subscription_last_payment_id = p_provider_payment_id,
        subscription_last_payment_status = p_status,
        updated_at = now()
    where id = p_business_id;
    return 'revoked';
  end if;

  update public.businesses
  set subscription_last_payment_id = p_provider_payment_id,
      subscription_last_payment_status = p_status,
      updated_at = now()
  where id = p_business_id;
  return case when v_previous_status = 'approved' then 'duplicate' else 'recorded' end;
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
set search_path = pg_catalog, public, pg_temp
as $$
begin
  update public.businesses
  set subscription_status = case
        when p_status = 'cancelled' and coalesce(subscription_current_period_end, trial_ends_at) <= now()
          then 'cancelled'
        else subscription_status
      end,
      subscription_cancel_at_period_end = case
        when p_status = 'cancelled' and subscription_current_period_end > now() then true
        else subscription_cancel_at_period_end
      end,
      pending_subscription_plan = case
        when p_status = 'cancelled' and subscription_status = 'trialing' then null
        else pending_subscription_plan
      end,
      subscription_current_period_end = coalesce(p_current_period_end, subscription_current_period_end),
      updated_at = now()
  where subscription_external_id = p_external_id;

  if not found then
    raise exception 'Suscripcion no encontrada';
  end if;
end;
$$;

create or replace function public.business_has_dashboard_access(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = target_business_id
      and (
        (b.subscription_status = 'trialing' and b.trial_ends_at > now())
        or (
          b.subscription_provider = 'mercadopago'
          and b.subscription_status in ('active', 'past_due', 'cancelled')
          and b.subscription_current_period_end > now()
        )
        or (
          b.subscription_status = 'active'
          and b.subscription_provider is distinct from 'mercadopago'
        )
      )
  );
$$;

create or replace function public.business_has_public_page_access(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = target_business_id
      and b.is_public = true
      and b.subscription_plan = 'pro'
      and public.business_has_dashboard_access(b.id)
  );
$$;

create or replace function public.business_has_booking_access(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.business_has_public_page_access(target_business_id);
$$;

revoke execute on function public.claim_subscription_operation(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.finish_subscription_operation(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.claim_subscription_webhook_event(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.finish_subscription_webhook_event(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.apply_mercadopago_subscription_payment(uuid, text, text, text, integer, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.sync_business_subscription_status(text, text, timestamptz) from public, anon, authenticated;

revoke insert, update on public.businesses from anon, authenticated;
grant insert (
  owner_id, name, slug, category, logo_url, brand_color, timezone, currency, is_public,
  payment_alias, payment_cbu, payment_instructions, description, logo_key,
  cover_image_url, cover_image_key, whatsapp_phone, public_address, service_mode, virtual_platforms
) on public.businesses to authenticated;
grant update (
  name, slug, category, logo_url, brand_color, timezone, currency, is_public,
  payment_alias, payment_cbu, payment_instructions, description, logo_key,
  cover_image_url, cover_image_key, whatsapp_phone, public_address, service_mode, virtual_platforms
) on public.businesses to authenticated;

-- Copia de 20260921003000_harden-payment-event-ordering.sql para alinear esta Preview con el esquema de Mercado Pago.
create unique index if not exists businesses_subscription_external_id_unique_idx
  on public.businesses(subscription_external_id)
  where subscription_external_id is not null;

create or replace function public.apply_mercadopago_subscription_payment(
  p_business_id uuid,
  p_subscription_external_id text,
  p_provider_payment_id text,
  p_status text,
  p_amount_cents integer,
  p_currency text,
  p_paid_at timestamptz default null,
  p_current_period_end timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_paid_plan text;
  v_previous_status text;
  v_period_end timestamptz;
begin
  select * into v_business
  from public.businesses
  where id = p_business_id
    and subscription_provider = 'mercadopago'
    and subscription_external_id = p_subscription_external_id
  for update;

  if not found then
    raise exception 'Suscripcion no encontrada';
  end if;

  if p_currency <> 'ARS' then
    raise exception 'Moneda de suscripcion invalida';
  end if;

  v_paid_plan := case p_amount_cents
    when 1400000 then 'essential'
    when 1800000 then 'pro'
    else null
  end;

  if v_paid_plan is null
    or (v_paid_plan <> v_business.subscription_plan
      and v_paid_plan is distinct from v_business.pending_subscription_plan) then
    raise exception 'Importe de suscripcion invalido';
  end if;

  select status into v_previous_status
  from public.subscription_payments
  where provider_payment_id = p_provider_payment_id;

  -- Reembolsos y contracargos son terminales. Un evento viejo nunca reactiva el acceso.
  if v_previous_status in ('refunded', 'charged_back') then
    return 'revoked';
  end if;

  -- Un rechazo tardío del mismo pago no puede degradar una aprobación ya procesada.
  if v_previous_status = 'approved' and p_status not in ('approved', 'refunded', 'charged_back') then
    return 'ignored_out_of_order';
  end if;

  insert into public.subscription_payments(
    business_id, provider_payment_id, subscription_external_id, status,
    amount_cents, currency, paid_at
  ) values (
    p_business_id, p_provider_payment_id, p_subscription_external_id, p_status,
    p_amount_cents, p_currency, p_paid_at
  )
  on conflict (provider_payment_id) do update
  set status = excluded.status,
      paid_at = coalesce(excluded.paid_at, public.subscription_payments.paid_at),
      updated_at = now();

  if p_status = 'approved' and v_previous_status is distinct from 'approved' then
    v_period_end := coalesce(p_current_period_end, coalesce(p_paid_at, now()) + interval '1 month');
    update public.businesses
    set subscription_status = 'active',
        subscription_plan = v_paid_plan,
        pending_subscription_plan = case
          when pending_subscription_plan = v_paid_plan then null
          else pending_subscription_plan
        end,
        subscription_current_period_end = v_period_end,
        subscription_cancel_at_period_end = false,
        subscription_checkout_url = null,
        subscription_last_payment_id = p_provider_payment_id,
        subscription_last_payment_status = p_status,
        subscription_last_payment_at = coalesce(p_paid_at, now()),
        updated_at = now()
    where id = p_business_id;
    return 'applied';
  elsif p_status in ('rejected', 'cancelled') then
    update public.businesses
    set subscription_status = 'past_due',
        subscription_last_payment_id = p_provider_payment_id,
        subscription_last_payment_status = p_status,
        updated_at = now()
    where id = p_business_id;
    return 'past_due';
  elsif p_status in ('refunded', 'charged_back') then
    update public.businesses
    set subscription_status = 'cancelled',
        pending_subscription_plan = null,
        subscription_current_period_end = now(),
        subscription_cancel_at_period_end = false,
        subscription_checkout_url = null,
        subscription_last_payment_id = p_provider_payment_id,
        subscription_last_payment_status = p_status,
        updated_at = now()
    where id = p_business_id;
    return 'revoked';
  end if;

  update public.businesses
  set subscription_last_payment_id = p_provider_payment_id,
      subscription_last_payment_status = p_status,
      updated_at = now()
  where id = p_business_id;
  return case when v_previous_status = 'approved' then 'duplicate' else 'recorded' end;
end;
$$;

revoke all on function public.apply_mercadopago_subscription_payment(uuid, text, text, text, integer, text, timestamptz, timestamptz)
  from public, anon, authenticated;

-- Copia de 20260921004500_handle-historical-payment-reversals.sql para alinear esta Preview con el esquema de Mercado Pago.
create or replace function public.revoke_mercadopago_historical_payment(
  p_business_id uuid,
  p_subscription_external_id text,
  p_provider_payment_id text,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_status not in ('refunded', 'charged_back') then
    return 'ignored_out_of_order';
  end if;

  if not exists (
    select 1
    from public.subscription_payments
    where business_id = p_business_id
      and provider_payment_id = p_provider_payment_id
      and subscription_external_id = p_subscription_external_id
      and status in ('approved', 'refunded', 'charged_back')
  ) then
    raise exception 'Pago historico no encontrado';
  end if;

  update public.subscription_payments
  set status = p_status,
      updated_at = now()
  where business_id = p_business_id
    and provider_payment_id = p_provider_payment_id
    and subscription_external_id = p_subscription_external_id;

  update public.businesses
  set subscription_status = 'cancelled',
      pending_subscription_plan = null,
      subscription_current_period_end = now(),
      subscription_cancel_at_period_end = false,
      subscription_checkout_url = null,
      subscription_last_payment_id = p_provider_payment_id,
      subscription_last_payment_status = p_status,
      updated_at = now()
  where id = p_business_id;

  return 'revoked';
end;
$$;

revoke all on function public.revoke_mercadopago_historical_payment(uuid, text, text, text)
  from public, anon, authenticated;

-- Copia de 20260921100000_track-mercadopago-authorization.sql para alinear esta Preview con el esquema de Mercado Pago.
create or replace function public.sync_business_subscription_status(
  p_external_id text,
  p_status text,
  p_current_period_end timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  update public.businesses
  set subscription_status = case
        when p_status = 'cancelled' and coalesce(subscription_current_period_end, trial_ends_at) <= now()
          then 'cancelled'
        else subscription_status
      end,
      subscription_cancel_at_period_end = case
        when p_status = 'cancelled' and subscription_current_period_end > now() then true
        else subscription_cancel_at_period_end
      end,
      pending_subscription_plan = case
        when p_status = 'cancelled' and subscription_status = 'trialing' then null
        else pending_subscription_plan
      end,
      subscription_checkout_url = case
        when p_status = 'authorized' then null
        else subscription_checkout_url
      end,
      subscription_current_period_end = coalesce(p_current_period_end, subscription_current_period_end),
      updated_at = now()
  where subscription_external_id = p_external_id;

  if not found then
    raise exception 'Suscripcion no encontrada';
  end if;
end;
$$;

revoke all on function public.sync_business_subscription_status(text, text, timestamptz)
  from public, anon, authenticated;

-- Copia de 20260921101500_preserve-unpaid-period.sql para alinear esta Preview con el esquema de Mercado Pago.
create or replace function public.sync_business_subscription_status(
  p_external_id text,
  p_status text,
  p_current_period_end timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  update public.businesses
  set subscription_status = case
        when p_status = 'cancelled' and coalesce(subscription_current_period_end, trial_ends_at) <= now()
          then 'cancelled'
        else subscription_status
      end,
      subscription_cancel_at_period_end = case
        when p_status = 'cancelled' and subscription_current_period_end > now() then true
        else subscription_cancel_at_period_end
      end,
      pending_subscription_plan = case
        when p_status = 'cancelled' and subscription_status = 'trialing' then null
        else pending_subscription_plan
      end,
      subscription_checkout_url = case
        when p_status = 'authorized' then null
        else subscription_checkout_url
      end,
      subscription_current_period_end = case
        when p_status = 'authorized' then subscription_current_period_end
        else coalesce(p_current_period_end, subscription_current_period_end)
      end,
      updated_at = now()
  where subscription_external_id = p_external_id;

  if not found then
    raise exception 'Suscripcion no encontrada';
  end if;
end;
$$;

revoke all on function public.sync_business_subscription_status(text, text, timestamptz)
  from public, anon, authenticated;

-- Restaurar acceso promocional tras las redefiniciones de Mercado Pago.
create or replace function public.business_has_dashboard_access(target_business_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = target_business_id
      and (
        (b.promotion_starts_at <= now() and b.promotion_ends_at > now())
        or (b.subscription_status = 'trialing' and b.trial_ends_at > now())
        or (
          b.subscription_provider = 'mercadopago'
          and b.subscription_status in ('active', 'past_due', 'cancelled')
          and b.subscription_current_period_end > now()
        )
        or (b.subscription_status = 'active' and b.subscription_provider is distinct from 'mercadopago')
      )
  );
$$;

create or replace function public.business_has_public_page_access(target_business_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = target_business_id and b.is_public = true
      and (
        (b.promotion_starts_at <= now() and b.promotion_ends_at > now())
        or (
          b.subscription_plan = 'pro'
          and public.business_has_dashboard_access(b.id)
        )
      )
  );
$$;

create or replace function public.sync_business_public_sections(
  p_business_id uuid, p_gallery_images jsonb, p_faqs jsonb
)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
      and public.business_has_dashboard_access(b.id)
      and (
        b.subscription_plan = 'pro'
        or (b.promotion_starts_at <= now() and b.promotion_ends_at > now())
      )
  ) then raise exception 'No autorizado'; end if;

  if jsonb_typeof(coalesce(p_gallery_images, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Galeria invalida';
  end if;
  if jsonb_array_length(coalesce(p_gallery_images, '[]'::jsonb)) > 10 then
    raise exception 'La galeria admite hasta 10 fotos';
  end if;
  if jsonb_typeof(coalesce(p_faqs, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'FAQ invalida';
  end if;
  if jsonb_array_length(coalesce(p_faqs, '[]'::jsonb)) > 10 then
    raise exception 'FAQ admite hasta 10 preguntas';
  end if;

  delete from public.business_gallery_images where business_id = p_business_id;
  insert into public.business_gallery_images (business_id, image_url, image_key, sort_order)
  select p_business_id, btrim(item->>'image_url'), btrim(item->>'image_key'), (position - 1)::smallint
  from jsonb_array_elements(coalesce(p_gallery_images, '[]'::jsonb)) with ordinality as gallery(item, position);

  delete from public.business_faqs where business_id = p_business_id;
  insert into public.business_faqs (business_id, question, answer, sort_order)
  select p_business_id, btrim(item->>'question'), btrim(item->>'answer'), (position - 1)::smallint
  from jsonb_array_elements(coalesce(p_faqs, '[]'::jsonb)) with ordinality as faq(item, position);
end;
$$;

revoke execute on function public.list_promo_codes() from public, anon, authenticated;
revoke execute on function public.update_promo_code(uuid, integer, integer, boolean) from public, anon, authenticated;
revoke execute on function public.claim_promo_redemption_attempt(uuid) from public, anon, authenticated;
revoke execute on function public.redeem_promo_code(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.business_has_dashboard_access(uuid) from public, anon;
revoke execute on function public.business_has_public_page_access(uuid) from public;
