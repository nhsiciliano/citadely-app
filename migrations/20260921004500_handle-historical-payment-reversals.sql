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
