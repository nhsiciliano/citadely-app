-- 3.9: el dashboard se actualiza solo cuando cambian los turnos del negocio.
-- Canal: business:<business_id>. Evento: appointments_changed {id, op} (sin datos personales).
-- Solo el dueño del negocio puede suscribirse; nadie publica desde el cliente (solo el trigger).

insert into realtime.channels (pattern, description, enabled)
values ('business:%', 'Cambios en los turnos de un negocio (dashboard en vivo)', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create or replace function public.realtime_business_channel_allowed(p_channel text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_channel is null or p_channel !~ '^business:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.user_owns_business(split_part(p_channel, ':', 2)::uuid);
end;
$$;

revoke all on function public.realtime_business_channel_allowed(text) from public, anon;
grant execute on function public.realtime_business_channel_allowed(text) to authenticated;

alter table realtime.channels enable row level security;
drop policy if exists "owners subscribe to their business channel" on realtime.channels;
create policy "owners subscribe to their business channel"
  on realtime.channels for select to authenticated
  using (pattern = 'business:%' and public.realtime_business_channel_allowed(realtime.channel_name()));

create or replace function public.notify_business_appointments_changed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, realtime, pg_temp
as $$
declare
  v_business_id uuid := coalesce(new.business_id, old.business_id);
  v_id uuid := coalesce(new.id, old.id);
begin
  perform realtime.publish(
    'business:' || v_business_id::text,
    'appointments_changed',
    jsonb_build_object('id', v_id, 'op', tg_op)
  );
  return null;
end;
$$;

revoke all on function public.notify_business_appointments_changed() from public, anon, authenticated;

drop trigger if exists notify_business_appointments_changed on public.appointments;
create trigger notify_business_appointments_changed
after insert or update or delete on public.appointments
for each row execute function public.notify_business_appointments_changed();
