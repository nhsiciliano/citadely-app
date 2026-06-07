create table if not exists public.business_notification_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_notification_settings_email_check check (position('@' in email) > 1)
);

drop trigger if exists business_notification_settings_updated_at on public.business_notification_settings;

create trigger business_notification_settings_updated_at
  before update on public.business_notification_settings
  for each row execute function public.set_updated_at();

alter table public.business_notification_settings enable row level security;

drop policy if exists "owners manage own business notification settings"
on public.business_notification_settings;

create policy "owners manage own business notification settings"
on public.business_notification_settings
for all
to authenticated
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

insert into public.business_notification_settings (business_id, email)
select b.id, u.email
from public.businesses b
join auth.users u on u.id = b.owner_id
where u.email is not null
on conflict (business_id) do update
set email = excluded.email;
