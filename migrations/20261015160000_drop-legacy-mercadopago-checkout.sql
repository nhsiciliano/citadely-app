-- Limpieza de la integración antigua de checkout único de Mercado Pago (reemplazada por suscripciones).
-- Antes de borrar las tablas se verificó que payments y reminders estén vacías y que no tengan claves
-- foráneas entrantes ni funciones que las usen fuera de las que se borran acá.
drop function if exists public.get_mercadopago_checkout_data(uuid);
drop function if exists public.set_mercadopago_checkout_preference(uuid, text, text);
drop function if exists public.confirm_mercadopago_payment(uuid, text, text);
drop table if exists public.payments;
drop table if exists public.reminders;
