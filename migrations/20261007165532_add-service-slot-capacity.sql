alter table public.service_availability_slots
  add column capacity integer not null default 1;

alter table public.service_availability_slots
  add constraint service_availability_slots_capacity_positive
  check (capacity between 1 and 1000);

create index if not exists appointments_active_slot_lookup_idx
  on public.appointments(business_id, service_id, starts_at, ends_at)
  where status <> 'cancelled';

-- A pending deposit holds a seat only until its deadline. This predicate is
-- deliberately shared by the slot guard and both booking RPCs.
create function public.appointment_holds_seat(
  p_status text,
  p_deposit_expires_at timestamptz
)
returns boolean
language sql stable
set search_path = pg_catalog, public, pg_temp
as $$
  select p_status <> 'cancelled'
    and (p_status <> 'pending_payment' or p_deposit_expires_at is null or p_deposit_expires_at > pg_catalog.now());
$$;

revoke all on function public.appointment_holds_seat(text, timestamptz) from public, anon, authenticated;

create function public.assert_service_slot_has_seat(
  p_business_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_client_email text,
  p_exclude_appointment_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_capacity integer;
  v_taken integer;
begin
  select slot.capacity into v_capacity
  from public.service_availability_slots slot
  where slot.business_id = p_business_id
    and slot.service_id = p_service_id
    and slot.starts_at = p_starts_at
    and slot.ends_at = p_ends_at
    and slot.is_active;

  if v_capacity is null then
    raise exception 'El horario seleccionado no esta habilitado';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.business_id = p_business_id
      and a.id is distinct from p_exclude_appointment_id
      and public.appointment_holds_seat(a.status, a.deposit_expires_at)
      and p_starts_at < a.ends_at and p_ends_at > a.starts_at
      and not (a.service_id = p_service_id and a.starts_at = p_starts_at and a.ends_at = p_ends_at)
  ) then
    raise exception 'El horario se superpone con otro servicio';
  end if;

  select count(*) into v_taken
  from public.appointments a
  where a.business_id = p_business_id
    and a.service_id = p_service_id
    and a.starts_at = p_starts_at
    and a.ends_at = p_ends_at
    and a.id is distinct from p_exclude_appointment_id
    and public.appointment_holds_seat(a.status, a.deposit_expires_at);

  if v_taken >= v_capacity then
    raise exception 'El horario ya no tiene cupos disponibles';
  end if;

  if v_capacity > 1 then
    if nullif(pg_catalog.btrim(p_client_email), '') is null then
      raise exception 'El cliente necesita un email para reservar este horario';
    end if;
    if exists (
      select 1 from public.appointments a
      join public.clients c on c.id = a.client_id
      where a.business_id = p_business_id
        and a.service_id = p_service_id
        and a.starts_at = p_starts_at
        and a.ends_at = p_ends_at
        and a.id is distinct from p_exclude_appointment_id
        and public.appointment_holds_seat(a.status, a.deposit_expires_at)
        and pg_catalog.lower(pg_catalog.btrim(c.email)) = pg_catalog.lower(pg_catalog.btrim(p_client_email))
    ) then
      raise exception 'Este email ya tiene una reserva para el horario';
    end if;
  end if;
end;
$$;

revoke all on function public.assert_service_slot_has_seat(uuid, uuid, timestamptz, timestamptz, text, uuid)
  from public, anon, authenticated;

create function public.guard_service_slot_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_taken integer;
begin
  if tg_op = 'UPDATE' then
    if new.business_id is distinct from old.business_id or new.service_id is distinct from old.service_id then
      raise exception 'No se puede cambiar el negocio o servicio de un horario';
    end if;
    if new.capacity = old.capacity and new.is_active = old.is_active
      and new.starts_at = old.starts_at and new.ends_at = old.ends_at then
      return new;
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.business_id::text, 0));
  select count(*) into v_taken
  from public.appointments a
  where a.business_id = old.business_id
    and a.service_id = old.service_id
    and a.starts_at = old.starts_at
    and a.ends_at = old.ends_at
    and public.appointment_holds_seat(a.status, a.deposit_expires_at);

  if v_taken > 0 and (tg_op = 'DELETE' or not new.is_active
    or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at) then
    raise exception 'No se puede quitar o mover un horario con reservas vigentes';
  end if;
  if tg_op = 'UPDATE' and new.capacity < v_taken then
    raise exception 'El cupo no puede ser menor que las reservas vigentes';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger guard_service_slot_capacity
before update or delete on public.service_availability_slots
for each row execute function public.guard_service_slot_capacity();

create function public.guard_appointment_seat_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_email text;
begin
  if new.business_id is distinct from old.business_id then
    raise exception 'No se puede cambiar el negocio de un turno';
  end if;
  if new.status = 'cancelled' or new.starts_at <= pg_catalog.now() then return new; end if;
  if new.service_id is not distinct from old.service_id
    and new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at
    and new.client_id is not distinct from old.client_id
    and public.appointment_holds_seat(old.status, old.deposit_expires_at) then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.business_id::text, 0));
  select c.email into v_email from public.clients c
  where c.id = new.client_id and c.business_id = new.business_id;
  if not found then raise exception 'Cliente no disponible para este negocio'; end if;
  perform public.assert_service_slot_has_seat(
    new.business_id, new.service_id, new.starts_at, new.ends_at, v_email, old.id
  );
  return new;
end;
$$;

create trigger guard_appointment_seat_update
before update on public.appointments
for each row execute function public.guard_appointment_seat_update();

create or replace function public.create_manual_appointment(
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
  v_client_email text;
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_business_id::text, 0));

  select c.email into v_client_email from public.clients c
  where c.id = p_client_id and c.business_id = p_business_id;
  if not found then raise exception 'Cliente no disponible para este negocio'; end if;

  select * into v_service from public.services s
  where s.id = p_service_id and s.business_id = p_business_id and s.is_active;
  if not found then raise exception 'Servicio no disponible'; end if;
  if p_starts_at <= pg_catalog.now() then raise exception 'El horario ya no esta disponible'; end if;

  v_ends_at := p_starts_at + pg_catalog.make_interval(mins => v_service.duration_minutes);
  perform public.assert_service_slot_has_seat(
    p_business_id, p_service_id, p_starts_at, v_ends_at, v_client_email
  );

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

create or replace function public.create_public_booking(
  p_business_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_email text,
  p_client_phone text default null,
  p_client_message text default null
)
returns table (
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
  if p_client_email is null or char_length(btrim(p_client_email)) not between 3 and 254
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_business_id::text, 0));
  select * into v_service from public.services s
  where s.id = p_service_id and s.business_id = p_business_id and s.is_active;
  if not found then raise exception 'Servicio no disponible'; end if;
  if p_starts_at <= pg_catalog.now() then raise exception 'El horario ya no esta disponible'; end if;

  v_ends_at := p_starts_at + pg_catalog.make_interval(mins => v_service.duration_minutes);
  perform public.assert_service_slot_has_seat(
    p_business_id, p_service_id, p_starts_at, v_ends_at, p_client_email
  );

  v_amount_cents := case v_service.deposit_type
    when 'full' then v_service.price_cents
    when 'deposit' then v_service.deposit_value_cents
    else 0
  end;
  v_status := case when v_amount_cents > 0 then 'pending_payment' else 'confirmed' end;
  v_deposit_expires_at := case
    when v_amount_cents > 0 then least(pg_catalog.now() + interval '2 hours', p_starts_at)
    else null
  end;

  insert into public.clients (business_id, name, email, phone)
  values (p_business_id, btrim(p_client_name), lower(btrim(p_client_email)), nullif(btrim(p_client_phone), ''))
  returning id into v_client_id;

  insert into public.appointments (
    business_id, client_id, service_id, starts_at, ends_at, status, source,
    client_message, deposit_amount_cents, deposit_expires_at
  ) values (
    p_business_id, v_client_id, p_service_id, p_starts_at, v_ends_at, v_status,
    'public_booking', nullif(btrim(p_client_message), ''), v_amount_cents, v_deposit_expires_at
  ) returning id into v_appointment_id;

  return query select v_appointment_id, v_client_id, null::uuid, v_status, v_amount_cents, v_deposit_expires_at;
end;
$$;
