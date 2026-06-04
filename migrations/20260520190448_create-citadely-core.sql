create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  category text not null default 'otros',
  logo_url text,
  brand_color text default '#286f5b',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  currency text not null default 'ARS',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_single_owner unique (owner_id),
  constraint businesses_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  color text default '#286f5b',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null,
  price_cents integer not null default 0,
  requires_payment boolean not null default false,
  deposit_type text not null default 'free',
  deposit_value_cents integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_duration_positive check (duration_minutes > 0),
  constraint services_price_nonnegative check (price_cents >= 0),
  constraint services_deposit_nonnegative check (deposit_value_cents >= 0),
  constraint services_deposit_type check (deposit_type in ('free', 'deposit', 'full'))
);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  weekday integer not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint working_hours_weekday check (weekday between 0 and 6),
  constraint working_hours_order check (start_time < end_time)
);

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_off_order check (starts_at < ends_at)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  notes_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  employee_id uuid references public.employees(id) on delete set null,
  service_id uuid not null references public.services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed',
  source text not null default 'business',
  client_message text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_order check (starts_at < ends_at),
  constraint appointments_status check (status in ('pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show')),
  constraint appointments_source check (source in ('business', 'public_booking', 'client'))
);

create table public.appointment_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null default 'mercadopago',
  provider_environment text not null default 'sandbox',
  external_id text,
  status text not null default 'pending',
  amount_cents integer not null,
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_provider check (provider in ('mercadopago')),
  constraint payments_environment check (provider_environment in ('sandbox', 'production')),
  constraint payments_status check (status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  constraint payments_amount_positive check (amount_cents >= 0)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  send_at timestamptz not null,
  status text not null default 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_status check (status in ('pending', 'sent', 'failed', 'cancelled'))
);

create index businesses_owner_id_idx on public.businesses(owner_id);
create index businesses_slug_idx on public.businesses(slug);
create index employees_business_id_idx on public.employees(business_id);
create index services_business_id_idx on public.services(business_id);
create index working_hours_business_id_idx on public.working_hours(business_id);
create index clients_business_id_idx on public.clients(business_id);
create index clients_user_id_idx on public.clients(user_id);
create index appointments_business_starts_idx on public.appointments(business_id, starts_at);
create index appointments_client_id_idx on public.appointments(client_id);
create index payments_business_id_idx on public.payments(business_id);
create index reminders_send_at_idx on public.reminders(send_at) where status = 'pending';

create trigger businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger employees_updated_at before update on public.employees for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger working_hours_updated_at before update on public.working_hours for each row execute function public.set_updated_at();
create trigger time_off_updated_at before update on public.time_off for each row execute function public.set_updated_at();
create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger appointment_notes_updated_at before update on public.appointment_notes for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger reminders_updated_at before update on public.reminders for each row execute function public.set_updated_at();

create or replace function public.user_owns_business(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses
    where id = target_business_id
      and owner_id = auth.uid()
  );
$$;

create or replace function public.user_is_appointment_client(target_appointment_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    join public.clients c on c.id = a.client_id
    where a.id = target_appointment_id
      and c.user_id = auth.uid()
  );
$$;

alter table public.businesses enable row level security;
alter table public.employees enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_notes enable row level security;
alter table public.payments enable row level security;
alter table public.reminders enable row level security;

create policy "public can read public businesses" on public.businesses for select using (is_public = true);
create policy "owners manage own business" on public.businesses for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "public can read active employees" on public.employees for select using (is_active = true and exists (select 1 from public.businesses b where b.id = business_id and b.is_public = true));
create policy "owners manage employees" on public.employees for all to authenticated using (public.user_owns_business(business_id)) with check (public.user_owns_business(business_id));

create policy "public can read active services" on public.services for select using (is_active = true and exists (select 1 from public.businesses b where b.id = business_id and b.is_public = true));
create policy "owners manage services" on public.services for all to authenticated using (public.user_owns_business(business_id)) with check (public.user_owns_business(business_id));

create policy "public can read active working hours" on public.working_hours for select using (is_active = true and exists (select 1 from public.businesses b where b.id = business_id and b.is_public = true));
create policy "owners manage working hours" on public.working_hours for all to authenticated using (public.user_owns_business(business_id)) with check (public.user_owns_business(business_id));

create policy "owners manage time off" on public.time_off for all to authenticated using (public.user_owns_business(business_id)) with check (public.user_owns_business(business_id));

create policy "owners manage clients" on public.clients for all to authenticated using (public.user_owns_business(business_id)) with check (public.user_owns_business(business_id));
create policy "clients read own profile rows" on public.clients for select to authenticated using (user_id = auth.uid());
create policy "clients update own profile rows" on public.clients for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owners manage appointments" on public.appointments for all to authenticated using (public.user_owns_business(business_id)) with check (public.user_owns_business(business_id));
create policy "clients read own appointments" on public.appointments for select to authenticated using (public.user_is_appointment_client(id));
create policy "clients reschedule or cancel own appointments" on public.appointments for update to authenticated using (public.user_is_appointment_client(id)) with check (public.user_is_appointment_client(id) and status in ('confirmed', 'cancelled'));

create policy "owners manage appointment notes" on public.appointment_notes for all to authenticated using (public.user_owns_business(business_id)) with check (public.user_owns_business(business_id));

create policy "owners read payments" on public.payments for select to authenticated using (public.user_owns_business(business_id));
create policy "clients read own payments" on public.payments for select to authenticated using (public.user_is_appointment_client(appointment_id));
create policy "owners manage reminders" on public.reminders for all to authenticated using (public.user_owns_business(business_id)) with check (public.user_owns_business(business_id));
