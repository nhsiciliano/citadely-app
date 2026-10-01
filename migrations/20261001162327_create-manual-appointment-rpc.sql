-- Manual bookings share the business-level transaction lock with public bookings.
-- The caller supplies IDs and start time only; every business rule is checked here.
create function public.create_manual_appointment(
  p_business_id uuid,
  p_client_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_service public.services%rowtype;
  v_ends_at timestamptz;
  v_amount_cents integer;
  v_appointment_id uuid;
begin
  if p_business_id is null or p_client_id is null or p_service_id is null or p_starts_at is null then
    raise exception 'Datos del turno incompletos';
  end if;

  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  ) or not public.business_has_dashboard_access(p_business_id) then
    raise exception 'No autorizado para crear turnos en este negocio';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_business_id::text, 0)
  );

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.business_id = p_business_id
  ) then
    raise exception 'Cliente no disponible para este negocio';
  end if;

  select * into v_service
  from public.services s
  where s.id = p_service_id
    and s.business_id = p_business_id
    and s.is_active = true;

  if not found then
    raise exception 'Servicio no disponible';
  end if;

  if p_starts_at <= pg_catalog.now() then
    raise exception 'El horario ya no esta disponible';
  end if;

  v_ends_at := p_starts_at + pg_catalog.make_interval(mins => v_service.duration_minutes);

  if not exists (
    select 1 from public.service_availability_slots slot
    where slot.business_id = p_business_id
      and slot.service_id = p_service_id
      and slot.is_active = true
      and slot.starts_at = p_starts_at
      and slot.ends_at = v_ends_at
  ) then
    raise exception 'El horario seleccionado no esta habilitado';
  end if;

  if exists (
    select 1 from public.appointments a
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

  insert into public.appointments (
    business_id, client_id, service_id, starts_at, ends_at,
    status, source, deposit_amount_cents
  ) values (
    p_business_id, p_client_id, p_service_id, p_starts_at, v_ends_at,
    case when v_amount_cents > 0 then 'pending_payment' else 'confirmed' end,
    'business', v_amount_cents
  ) returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

revoke insert on public.appointments from public, anon, authenticated;
revoke all on function public.create_manual_appointment(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.create_manual_appointment(uuid, uuid, uuid, timestamptz) to authenticated;
