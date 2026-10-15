-- 2.4: ningun camino de escritura (incluida la service key) puede sobrevender un horario,
-- y no se pueden duplicar clientes por email dentro de un negocio.

-- 1. Trigger de capacidad en INSERT. El de UPDATE (guard_appointment_seat_update) ya existe;
--    con este, un insert directo con la service key tambien pasa por assert_service_slot_has_seat.
create or replace function public.guard_appointment_seat_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_email text;
begin
  -- Turnos que no ocupan plaza o ya pasaron (historicos, importaciones) no se validan, igual que en UPDATE.
  if new.starts_at <= pg_catalog.now()
    or not public.appointment_holds_seat(new.status, new.deposit_expires_at) then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.business_id::text, 0));
  select c.email into v_email from public.clients c
  where c.id = new.client_id and c.business_id = new.business_id;
  if not found then raise exception 'Cliente no disponible para este negocio'; end if;
  perform public.assert_service_slot_has_seat(
    new.business_id, new.service_id, new.starts_at, new.ends_at, v_email, new.id
  );
  return new;
end;
$$;

revoke all on function public.guard_appointment_seat_insert() from public, anon, authenticated;

drop trigger if exists guard_appointment_seat_insert on public.appointments;
create trigger guard_appointment_seat_insert
before insert on public.appointments
for each row execute function public.guard_appointment_seat_insert();

-- 2. Clientes duplicados: se unifican (se conserva el mas antiguo, los turnos se reasignan) y luego
--    se crea el indice unico. Es un no-op si no hay duplicados.
do $$
declare
  v_dup record;
begin
  for v_dup in
    select c.id as dup_id,
      first_value(c.id) over (
        partition by c.business_id, pg_catalog.lower(pg_catalog.btrim(c.email))
        order by c.created_at, c.id
      ) as keep_id
    from public.clients c
    where c.email is not null and pg_catalog.btrim(c.email) <> ''
  loop
    if v_dup.dup_id <> v_dup.keep_id then
      update public.appointments set client_id = v_dup.keep_id where client_id = v_dup.dup_id;
      update public.clients keep
      set phone = coalesce(keep.phone, dup.phone),
          notes_summary = coalesce(keep.notes_summary, dup.notes_summary),
          user_id = coalesce(keep.user_id, dup.user_id)
      from public.clients dup
      where keep.id = v_dup.keep_id and dup.id = v_dup.dup_id;
      delete from public.clients where id = v_dup.dup_id;
    end if;
  end loop;
end;
$$;

create unique index if not exists clients_business_email_unique_idx
  on public.clients (business_id, (pg_catalog.lower(pg_catalog.btrim(email))))
  where email is not null and pg_catalog.btrim(email) <> '';

-- 3. create_public_booking (misma firma de 7 parametros): el cliente se resuelve con upsert.
--    Si el email ya existe en el negocio se reutiliza ese cliente; no se pisan nombre ni notas
--    (cualquiera podria cambiar el nombre de un cliente real reservando con su email).
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

  insert into public.clients as c (business_id, name, email, phone)
  values (p_business_id, btrim(p_client_name), lower(btrim(p_client_email)), nullif(btrim(p_client_phone), ''))
  on conflict (business_id, (lower(btrim(email))))
    where email is not null and btrim(email) <> ''
  do update set phone = coalesce(c.phone, excluded.phone)
  returning c.id into v_client_id;

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

-- Los grants de create_public_booking no cambian (create or replace los conserva): solo project_admin.
