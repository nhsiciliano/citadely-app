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
  amount_cents integer
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
  v_payment_id uuid;
begin
  if not exists (
    select 1 from public.businesses
    where id = p_business_id and is_public = true
  ) then
    raise exception 'Negocio no disponible';
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
    client_message
  )
  values (
    p_business_id,
    v_client_id,
    p_service_id,
    p_starts_at,
    v_ends_at,
    v_status,
    'public_booking',
    p_client_message
  )
  returning id into v_appointment_id;

  if v_amount_cents > 0 then
    insert into public.payments (
      appointment_id,
      business_id,
      amount_cents,
      status,
      provider,
      provider_environment
    )
    values (
      v_appointment_id,
      p_business_id,
      v_amount_cents,
      'pending',
      'mercadopago',
      'sandbox'
    )
    returning id into v_payment_id;
  end if;

  return query select v_appointment_id, v_client_id, v_payment_id, v_status, v_amount_cents;
end;
$$;

grant execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text) to anon, authenticated;
