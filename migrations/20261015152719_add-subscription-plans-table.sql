-- 2.6: subscription_plans es la unica fuente de precios de suscripcion.
-- La app (landing, configuracion, checkout de Mercado Pago) y apply_mercadopago_subscription_payment la leen.
-- Para cambiar un precio: desactivar la fila vigente e insertar una nueva con el mismo code (la anterior queda
-- como historial para validar cobros de suscripciones que aun pagan el importe viejo).

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'ARS' check (currency = 'ARS'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint subscription_plans_code_amount_unique unique (code, amount_cents, currency),
  -- Un importe identifica un solo plan: asi el cobro se puede resolver por monto sin ambiguedad.
  constraint subscription_plans_amount_unique unique (amount_cents, currency)
);

create unique index subscription_plans_one_active_per_code_idx
  on public.subscription_plans(code) where is_active;

alter table public.subscription_plans enable row level security;
revoke all on public.subscription_plans from public, anon, authenticated;
grant select (code, amount_cents, currency) on public.subscription_plans to anon, authenticated;

-- Los precios vigentes son publicos (landing). El historial inactivo no se expone.
create policy "Subscription plans are publicly readable"
  on public.subscription_plans for select
  to anon, authenticated
  using (is_active);

insert into public.subscription_plans (code, amount_cents, currency) values
  ('essential', 1400000, 'ARS'),
  ('pro', 1800000, 'ARS');

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

  -- Los importes validos salen de subscription_plans (incluye precios anteriores ya inactivos,
  -- para que un suscriptor con el importe viejo siga siendo reconocido).
  select p.code into v_paid_plan
  from public.subscription_plans p
  where p.amount_cents = p_amount_cents and p.currency = p_currency;

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
