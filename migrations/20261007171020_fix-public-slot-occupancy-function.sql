create or replace function public.get_public_slot_occupancy(
  p_business_id uuid,
  p_slot_ids uuid[]
)
returns table (
  slot_id uuid,
  booked integer,
  blocked_by_other_service boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.business_has_booking_access(p_business_id) then
    return;
  end if;
  if coalesce(pg_catalog.array_length(p_slot_ids, 1), 0) > 1000 then
    raise exception 'Demasiados horarios solicitados';
  end if;

  return query
  select slot.id, occupancy.booked, occupancy.blocked_by_other_service
  from public.service_availability_slots slot
  cross join lateral (
    select
      count(*) filter (
        where a.service_id = slot.service_id
          and a.starts_at = slot.starts_at
          and a.ends_at = slot.ends_at
      )::integer as booked,
      coalesce(pg_catalog.bool_or(
        not (a.service_id = slot.service_id
          and a.starts_at = slot.starts_at
          and a.ends_at = slot.ends_at)
      ), false) as blocked_by_other_service
    from public.appointments a
    where a.business_id = slot.business_id
      and a.starts_at < slot.ends_at
      and a.ends_at > slot.starts_at
      and public.appointment_holds_seat(a.status, a.deposit_expires_at)
  ) occupancy
  where slot.business_id = p_business_id
    and slot.id = any(p_slot_ids)
    and slot.is_active
    and slot.starts_at > pg_catalog.now();
end;
$$;
