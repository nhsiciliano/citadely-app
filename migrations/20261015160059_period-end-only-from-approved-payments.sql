-- El período pago solo lo extiende un pago aprobado (apply_mercadopago_subscription_payment).
-- Antes, cualquier notificación de preapproval que no fuera 'authorized' copiaba next_payment_date en
-- subscription_current_period_end: una suscripción cancelada, pausada o pendiente con próxima fecha futura
-- daba acceso pago sin cobro. p_current_period_end se conserva en la firma por compatibilidad y se ignora.
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
      updated_at = now()
  where subscription_external_id = p_external_id;

  if not found then
    raise exception 'Suscripcion no encontrada';
  end if;
end;
$$;

revoke all on function public.sync_business_subscription_status(text, text, timestamptz)
  from public, anon, authenticated;

-- RPC legacy sin uso en la app: activaba el plan y extendía el período sin verificar ningún pago.
drop function if exists public.sync_business_subscription_payment(uuid, text, timestamptz);
