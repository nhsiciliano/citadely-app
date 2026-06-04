create table if not exists public.service_availability_slots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_availability_slots_order check (starts_at < ends_at),
  constraint service_availability_slots_unique_start unique (service_id, starts_at)
);

create index if not exists service_availability_slots_business_id_idx
  on public.service_availability_slots(business_id);

create index if not exists service_availability_slots_service_starts_at_idx
  on public.service_availability_slots(service_id, starts_at);

create trigger service_availability_slots_updated_at
  before update on public.service_availability_slots
  for each row execute function public.set_updated_at();

alter table public.service_availability_slots enable row level security;

create policy "public can read active service availability slots"
on public.service_availability_slots
for select
using (
  is_active = true
  and exists (
    select 1
    from public.businesses b
    join public.services s on s.business_id = b.id
    where b.id = service_availability_slots.business_id
      and s.id = service_availability_slots.service_id
      and b.is_public = true
      and s.is_active = true
  )
);

create policy "owners manage service availability slots"
on public.service_availability_slots
for all
to authenticated
using (public.user_owns_business(business_id))
with check (
  public.user_owns_business(business_id)
  and exists (
    select 1
    from public.services s
    where s.id = service_availability_slots.service_id
      and s.business_id = service_availability_slots.business_id
  )
);

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
set search_path = public
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
  if not public.business_has_booking_access(p_business_id) then
    raise exception 'Negocio no disponible para reservas';
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
  v_deposit_expires_at := case when v_amount_cents > 0 then now() + interval '30 minutes' else null end;

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
    p_client_message,
    v_amount_cents,
    v_deposit_expires_at
  )
  returning id into v_appointment_id;

  return query select v_appointment_id, v_client_id, null::uuid, v_status, v_amount_cents, v_deposit_expires_at;
end;
$$;

grant execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text) to anon, authenticated;
