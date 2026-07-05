revoke execute on function public.cancel_expired_deposit_bookings() from anon, authenticated;

revoke execute on function public.sync_business_subscription_status(text, text, timestamptz) from anon, authenticated;

revoke execute on function public.sync_business_subscription_payment(uuid, text, timestamptz) from anon, authenticated;

revoke execute on function public.confirm_mercadopago_payment(uuid, text, text) from anon, authenticated;

revoke execute on function public.get_mercadopago_checkout_data(uuid) from anon, authenticated;

revoke execute on function public.set_mercadopago_checkout_preference(uuid, text, text) from anon, authenticated;
