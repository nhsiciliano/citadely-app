-- 3.7: transiciones de estado de turno validas y motivo de cancelacion.
-- La tabla de transiciones vive en una sola funcion usada por el trigger (todos los caminos de escritura)
-- y por la RPC update_appointment_status (la que usa el dashboard). Mantener lib/appointment-status.ts en sync.
--
--   pending_payment -> confirmed | cancelled
--   confirmed       -> completed | no_show | cancelled
--   completed       -> no_show | confirmed
--   no_show         -> completed | confirmed
--   cancelled       -> confirmed        (el guard de cupo valida que el horario siga libre)
--
-- Nunca se vuelve a pending_payment.

create or replace function public.is_valid_appointment_transition(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select p_from = p_to or (p_from, p_to) in (
    ('pending_payment', 'confirmed'),
    ('pending_payment', 'cancelled'),
    ('confirmed', 'completed'),
    ('confirmed', 'no_show'),
    ('confirmed', 'cancelled'),
    ('completed', 'no_show'),
    ('completed', 'confirmed'),
    ('no_show', 'completed'),
    ('no_show', 'confirmed'),
    ('cancelled', 'confirmed')
  );
$$;

create or replace function public.guard_appointment_status_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    if not public.is_valid_appointment_transition(old.status, new.status) then
      raise exception 'Transicion de estado no permitida: % a %', old.status, new.status;
    end if;
    -- El motivo solo tiene sentido mientras el turno esta cancelado.
    if new.status <> 'cancelled' then
      new.cancellation_reason := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_appointment_status_transition on public.appointments;
create trigger guard_appointment_status_transition
before update of status on public.appointments
for each row execute function public.guard_appointment_status_transition();

create or replace function public.update_appointment_status(
  p_appointment_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_appointment public.appointments%rowtype;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if p_status is null or p_status not in ('pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show') then
    raise exception 'Estado de turno invalido';
  end if;
  if v_reason is not null and pg_catalog.char_length(v_reason) > 500 then
    raise exception 'El motivo puede tener hasta 500 caracteres';
  end if;

  select * into v_appointment from public.appointments a where a.id = p_appointment_id for update;
  if not found then raise exception 'Turno no encontrado'; end if;

  if not public.user_can_write_business(v_appointment.business_id) then
    raise exception 'No autorizado para modificar turnos de este negocio';
  end if;

  if v_appointment.status = p_status then
    -- Idempotente; solo permite corregir el motivo de un turno ya cancelado.
    if p_status = 'cancelled' and v_reason is distinct from v_appointment.cancellation_reason then
      update public.appointments set cancellation_reason = v_reason where id = v_appointment.id;
    end if;
    return;
  end if;

  if p_status = 'pending_payment' then
    raise exception 'Un turno no puede volver a seña pendiente';
  end if;
  if not public.is_valid_appointment_transition(v_appointment.status, p_status) then
    raise exception 'No se puede pasar un turno de % a %', v_appointment.status, p_status;
  end if;
  if p_status = 'confirmed' and v_appointment.status = 'pending_payment' and v_appointment.deposit_amount_cents > 0 then
    raise exception 'Confirmá la seña recibida para confirmar este turno';
  end if;
  if p_status in ('completed', 'no_show') and v_appointment.starts_at > pg_catalog.now() then
    raise exception 'Solo se puede marcar como completado o no asistió después del horario del turno';
  end if;

  update public.appointments
  set status = p_status,
      cancellation_reason = case when p_status = 'cancelled' then v_reason else null end
  where id = v_appointment.id;
end;
$$;

revoke all on function public.update_appointment_status(uuid, text, text) from public, anon;
grant execute on function public.update_appointment_status(uuid, text, text) to authenticated;
