-- Citadely es gratuito: se eliminan suscripciones, planes y códigos promocionales.
-- Va DESPUÉS del deploy que deja de usarlos (C4 a C9) y de cancelar los preapprovals en Mercado Pago.
-- Los aportes viven en contributions (20261024120100); los webhooks, en mercadopago_webhook_events.
-- businesses.is_demo se conserva. Idempotente: todo es drop ... if exists.

-- Compatibilidad de 20261024120100: vista y wrappers sobre mercadopago_webhook_events.
drop view if exists public.subscription_webhook_events;
drop function if exists public.claim_subscription_webhook_event(text, text, text, text, text);
drop function if exists public.finish_subscription_webhook_event(uuid, text, text);

-- Suscripciones.
drop function if exists public.get_business_access_state(uuid);
drop function if exists public.apply_mercadopago_subscription_payment(uuid, text, text, text, integer, text, timestamptz, timestamptz);
drop function if exists public.sync_business_subscription_status(text, text, timestamptz);
drop function if exists public.revoke_mercadopago_historical_payment(uuid, text, text, text);
drop function if exists public.claim_subscription_operation(uuid, uuid, text, text);
drop function if exists public.finish_subscription_operation(uuid, text, jsonb, text);
drop function if exists public.set_business_subscription_checkout(uuid, text, text);

-- Códigos promocionales.
drop function if exists public.redeem_promo_code(uuid, uuid, text);
drop function if exists public.claim_promo_redemption_attempt(uuid);
drop function if exists public.list_promo_codes();
drop function if exists public.update_promo_code(uuid, integer, integer, boolean);

drop table if exists public.subscription_payments;
drop table if exists public.subscription_operations;
drop table if exists public.subscription_plans;
drop table if exists public.promo_redemption_attempts;
drop table if exists public.promo_redemptions;
drop table if exists public.promo_codes;

-- Ninguna función que quede puede seguir leyendo las columnas que se eliminan abajo: plpgsql no
-- registra dependencias, así que un drop column silencioso rompería la función recién al ejecutarla.
do $$
declare
  v_functions text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname)
  into v_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosrc ~ '(subscription_(status|provider|external_id|checkout_url|current_period_end|plan|cancel_at_period_end|last_payment_id|last_payment_status|last_payment_at)|pending_subscription_plan|trial_ends_at|promotion_(starts|ends)_at)';

  if v_functions is not null then
    raise exception 'Funciones que todavía usan columnas de suscripción: %', v_functions;
  end if;
end;
$$;

drop index if exists public.businesses_subscription_external_id_idx;
drop index if exists public.businesses_subscription_external_id_unique_idx;

alter table public.businesses
  drop constraint if exists businesses_pending_subscription_plan_check,
  drop constraint if exists businesses_promotion_window_check,
  drop constraint if exists businesses_subscription_plan_check,
  drop constraint if exists businesses_subscription_status_check;

alter table public.businesses
  drop column if exists trial_ends_at,
  drop column if exists subscription_status,
  drop column if exists subscription_provider,
  drop column if exists subscription_external_id,
  drop column if exists subscription_checkout_url,
  drop column if exists subscription_current_period_end,
  drop column if exists subscription_plan,
  drop column if exists pending_subscription_plan,
  drop column if exists subscription_cancel_at_period_end,
  drop column if exists subscription_last_payment_id,
  drop column if exists subscription_last_payment_status,
  drop column if exists subscription_last_payment_at,
  drop column if exists promotion_starts_at,
  drop column if exists promotion_ends_at;
