-- Remove unnecessary anonymous write privileges. Public bookings go through the
-- validated SECURITY DEFINER RPC below; direct table writes stay denied both by
-- privileges and by RLS.
revoke insert, update, delete on public.appointment_notes from anon;
revoke insert, update, delete on public.appointments from anon;
revoke insert, update, delete on public.business_notification_settings from anon;
revoke insert, update, delete on public.businesses from anon;
revoke insert, update, delete on public.clients from anon;
revoke insert, update, delete on public.employees from anon;
revoke insert, update, delete on public.payments from anon;
revoke insert, update, delete on public.reminders from anon;
revoke insert, update, delete on public.service_availability_slots from anon;
revoke insert, update, delete on public.services from anon;
revoke insert, update, delete on public.time_off from anon;
revoke insert, update, delete on public.working_hours from anon;

-- This helper is only used by authenticated dashboard flows.
revoke execute on function public.business_has_dashboard_access(uuid) from anon;

-- Pin every application SECURITY DEFINER function to trusted schemas. This
-- prevents object-shadowing attacks while preserving the RLS helper pattern.
alter function public.cancel_expired_deposit_bookings()
  set search_path = pg_catalog, public, pg_temp;
alter function public.confirm_appointment_deposit(uuid)
  set search_path = pg_catalog, public, pg_temp;
alter function public.confirm_mercadopago_payment(uuid, text, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.get_mercadopago_checkout_data(uuid)
  set search_path = pg_catalog, public, pg_temp;
alter function public.set_business_subscription_checkout(uuid, text, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.set_mercadopago_checkout_preference(uuid, text, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.user_is_appointment_client(uuid)
  set search_path = pg_catalog, public, pg_temp;
alter function public.user_owns_business(uuid)
  set search_path = pg_catalog, public, pg_temp;

-- Bound user-controlled public booking text at the database boundary. NOT VALID
-- still protects every new write without making deployment depend on historical
-- production rows; validation can be completed after the preflight check.
alter table public.clients
  add constraint clients_name_length
  check (char_length(btrim(name)) between 1 and 120) not valid;
alter table public.clients
  add constraint clients_email_length
  check (email is null or char_length(btrim(email)) between 3 and 254) not valid;
alter table public.clients
  add constraint clients_phone_length
  check (phone is null or char_length(btrim(phone)) between 1 and 40) not valid;
alter table public.appointments
  add constraint appointments_client_message_length
  check (client_message is null or char_length(client_message) <= 2000) not valid;

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

  -- Serialize public bookings per business so concurrent requests cannot both
  -- pass the overlap check before either appointment is inserted.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_business_id::text, 0)
  );

  select * into v_service
  from public.services
  where id = p_service_id
    and business_id = p_business_id
    and is_active = true;

  if not found then
    raise exception 'Servicio no disponible';
  end if;

  v_ends_at := p_starts_at + pg_catalog.make_interval(mins => v_service.duration_minutes);

  if p_starts_at <= pg_catalog.now() then
    raise exception 'El horario ya no esta disponible';
  end if;

  if not exists (
    select 1
    from public.service_availability_slots slot
    where slot.business_id = p_business_id
      and slot.service_id = p_service_id
      and slot.is_active = true
      and slot.starts_at = p_starts_at
      and slot.ends_at = v_ends_at
  ) then
    raise exception 'El horario seleccionado no esta habilitado';
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
  v_deposit_expires_at := case
    when v_amount_cents > 0 then pg_catalog.now() + interval '30 minutes'
    else null
  end;

  insert into public.clients (business_id, name, email, phone)
  values (
    p_business_id,
    btrim(p_client_name),
    lower(btrim(p_client_email)),
    nullif(btrim(p_client_phone), '')
  )
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
    nullif(btrim(p_client_message), ''),
    v_amount_cents,
    v_deposit_expires_at
  )
  returning id into v_appointment_id;

  return query
  select v_appointment_id, v_client_id, null::uuid, v_status, v_amount_cents, v_deposit_expires_at;
end;
$$;

revoke execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text) from public;
grant execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text) to anon, authenticated;
