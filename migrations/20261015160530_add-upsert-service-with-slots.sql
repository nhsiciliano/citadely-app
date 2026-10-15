-- 3.6: crear o editar un servicio junto con su disponibilidad en una sola transaccion.
-- Reemplaza la secuencia de N requests del cliente (que podia dejar servicios sin horarios o a medias).
-- p_slots es el conjunto deseado de horarios dentro de [p_window_start, p_window_end): los existentes que no
-- esten se desactivan, los nuevos se crean y los modificados se actualizan. Los horarios fuera de esa ventana
-- no se tocan. Los guards de cupo (guard_service_slot_capacity) siguen aplicando y abortan toda la operacion.

create or replace function public.upsert_service_with_slots(
  p_business_id uuid,
  p_service_id uuid,
  p_name text,
  p_description text,
  p_image_url text,
  p_duration_minutes integer,
  p_price_cents integer,
  p_deposit_type text,
  p_deposit_value_cents integer,
  p_slots jsonb,
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_service_id uuid;
  v_name text := pg_catalog.btrim(coalesce(p_name, ''));
  v_deposit_cents integer;
  v_slot record;
  v_existing public.service_availability_slots%rowtype;
  v_ends_at timestamptz;
  v_starts timestamptz[] := '{}';
  v_now timestamptz := pg_catalog.now();
begin
  if not public.user_can_write_business(p_business_id) then
    raise exception 'No autorizado para modificar servicios de este negocio';
  end if;

  if pg_catalog.char_length(v_name) not between 1 and 120 then
    raise exception 'El nombre del servicio debe tener entre 1 y 120 caracteres';
  end if;
  if pg_catalog.char_length(coalesce(p_description, '')) > 1000 then
    raise exception 'La descripcion es demasiado larga';
  end if;
  if pg_catalog.char_length(coalesce(p_image_url, '')) > 2000 then
    raise exception 'La URL de la imagen es demasiado larga';
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 1 and 1440 then
    raise exception 'La duracion debe estar entre 1 y 1440 minutos';
  end if;
  if p_price_cents is null or p_price_cents not between 0 and 100000000 then
    raise exception 'El precio no es valido';
  end if;
  if p_deposit_type is null or p_deposit_type not in ('free', 'deposit', 'full') then
    raise exception 'El tipo de cobro no es valido';
  end if;

  v_deposit_cents := case p_deposit_type
    when 'free' then 0
    when 'full' then p_price_cents
    else coalesce(p_deposit_value_cents, 0)
  end;
  if p_deposit_type = 'deposit' and (v_deposit_cents < 1 or v_deposit_cents > p_price_cents) then
    raise exception 'La sena debe ser mayor a cero y no puede superar el precio';
  end if;

  if p_slots is null or pg_catalog.jsonb_typeof(p_slots) <> 'array' or pg_catalog.jsonb_array_length(p_slots) = 0 then
    raise exception 'Agrega al menos un dia y horario para publicar este servicio';
  end if;
  if pg_catalog.jsonb_array_length(p_slots) > 1000 then
    raise exception 'Demasiados horarios en una sola operacion';
  end if;
  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then
    raise exception 'La ventana de disponibilidad no es valida';
  end if;

  -- Misma clave que las reservas: serializa con create_public_booking y create_manual_appointment.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_business_id::text, 0));

  if p_service_id is null then
    insert into public.services (
      business_id, name, description, image_url, duration_minutes, price_cents,
      requires_payment, deposit_type, deposit_value_cents
    ) values (
      p_business_id, v_name, coalesce(p_description, ''), coalesce(p_image_url, ''), p_duration_minutes, p_price_cents,
      p_deposit_type <> 'free', p_deposit_type, v_deposit_cents
    ) returning id into v_service_id;
  else
    update public.services s
    set name = v_name,
        description = coalesce(p_description, ''),
        image_url = coalesce(p_image_url, ''),
        duration_minutes = p_duration_minutes,
        price_cents = p_price_cents,
        requires_payment = p_deposit_type <> 'free',
        deposit_type = p_deposit_type,
        deposit_value_cents = v_deposit_cents,
        updated_at = v_now
    where s.id = p_service_id and s.business_id = p_business_id
    returning s.id into v_service_id;
    if v_service_id is null then raise exception 'Servicio no disponible'; end if;
  end if;

  for v_slot in
    select * from pg_catalog.jsonb_to_recordset(p_slots) as x(starts_at timestamptz, capacity integer)
  loop
    if v_slot.starts_at is null then raise exception 'Horario invalido'; end if;
    if v_slot.capacity is null or v_slot.capacity not between 1 and 1000 then
      raise exception 'El cupo de cada horario debe estar entre 1 y 1000 personas';
    end if;
    if v_slot.starts_at < p_window_start or v_slot.starts_at >= p_window_end then
      raise exception 'Hay horarios fuera del periodo editable';
    end if;
    if v_slot.starts_at = any (v_starts) then
      raise exception 'Hay horarios repetidos';
    end if;
    v_starts := v_starts || v_slot.starts_at;
    v_ends_at := v_slot.starts_at + pg_catalog.make_interval(mins => p_duration_minutes);

    select * into v_existing from public.service_availability_slots
    where service_id = v_service_id and starts_at = v_slot.starts_at;

    -- Sin cambios: no se toca (permite conservar horarios pasados que ya existian).
    if found and v_existing.is_active and v_existing.ends_at = v_ends_at and v_existing.capacity = v_slot.capacity then
      continue;
    end if;
    if v_slot.starts_at <= v_now then
      raise exception 'No se pueden publicar ni modificar horarios que ya pasaron';
    end if;

    insert into public.service_availability_slots (business_id, service_id, starts_at, ends_at, capacity, is_active)
    values (p_business_id, v_service_id, v_slot.starts_at, v_ends_at, v_slot.capacity, true)
    on conflict (service_id, starts_at) do update
      set ends_at = excluded.ends_at, capacity = excluded.capacity, is_active = true;
  end loop;

  -- Lo que estaba publicado en la ventana y ya no esta en la lista deseada se desactiva.
  update public.service_availability_slots
  set is_active = false
  where service_id = v_service_id
    and is_active
    and starts_at >= p_window_start and starts_at < p_window_end
    and starts_at <> all (v_starts);

  return v_service_id;
end;
$$;

revoke all on function public.upsert_service_with_slots(uuid, uuid, text, text, text, integer, integer, text, integer, jsonb, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.upsert_service_with_slots(uuid, uuid, text, text, text, integer, integer, text, integer, jsonb, timestamptz, timestamptz)
  to authenticated;
