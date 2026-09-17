alter table public.businesses
  add column if not exists subscription_plan text not null default 'pro',
  add column if not exists pending_subscription_plan text;

update public.businesses
set subscription_plan = 'pro'
where subscription_plan is null or subscription_plan not in ('essential', 'pro');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_subscription_plan_check'
  ) then
    alter table public.businesses
      add constraint businesses_subscription_plan_check
      check (subscription_plan in ('essential', 'pro'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'businesses_pending_subscription_plan_check'
  ) then
    alter table public.businesses
      add constraint businesses_pending_subscription_plan_check
      check (pending_subscription_plan is null or pending_subscription_plan in ('essential', 'pro'));
  end if;
end $$;

create or replace function public.business_has_dashboard_access(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = target_business_id
      and (
        b.subscription_status = 'active'
        or (b.subscription_status = 'trialing' and b.trial_ends_at > now())
      )
  );
$$;

create or replace function public.business_has_public_page_access(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = target_business_id
      and b.is_public = true
      and (
        (b.subscription_status = 'trialing' and b.trial_ends_at > now())
        or (b.subscription_status = 'active' and b.subscription_plan = 'pro')
      )
  );
$$;

create or replace function public.business_has_booking_access(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.business_has_public_page_access(target_business_id);
$$;

drop policy if exists "public can read public businesses" on public.businesses;
create policy "public can read public businesses"
on public.businesses for select
using (public.business_has_public_page_access(id));

drop policy if exists "public can read active employees" on public.employees;
create policy "public can read active employees"
on public.employees for select
using (is_active = true and public.business_has_public_page_access(business_id));

drop policy if exists "public can read active services" on public.services;
create policy "public can read active services"
on public.services for select
using (is_active = true and public.business_has_public_page_access(business_id));

drop policy if exists "public can read active working hours" on public.working_hours;
create policy "public can read active working hours"
on public.working_hours for select
using (is_active = true and public.business_has_public_page_access(business_id));

drop policy if exists "public can read active service availability slots" on public.service_availability_slots;
create policy "public can read active service availability slots"
on public.service_availability_slots for select
using (
  is_active = true
  and public.business_has_public_page_access(business_id)
  and exists (
    select 1 from public.services s
    where s.id = service_availability_slots.service_id
      and s.business_id = service_availability_slots.business_id
      and s.is_active = true
  )
);

drop policy if exists "public can create booking clients" on public.clients;
drop policy if exists "anon can create booking clients" on public.clients;
drop policy if exists "public can create booking appointments" on public.appointments;
drop policy if exists "anon can create booking appointments" on public.appointments;
drop policy if exists "public can create pending booking payments" on public.payments;
drop policy if exists "anon can create pending booking payments" on public.payments;

create or replace function public.sync_business_subscription_status(
  p_external_id text,
  p_status text,
  p_current_period_end timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_status text;
begin
  v_status := case p_status
    when 'authorized' then 'active'
    when 'active' then 'active'
    when 'paused' then 'past_due'
    when 'pending' then 'past_due'
    when 'cancelled' then 'cancelled'
    else 'past_due'
  end;

  update public.businesses
  set
    subscription_provider = 'mercadopago',
    subscription_plan = case
      when v_status = 'active' and subscription_status <> 'active'
        then coalesce(pending_subscription_plan, subscription_plan)
      else subscription_plan
    end,
    pending_subscription_plan = case
      when v_status = 'active' and subscription_status <> 'active' then null
      else pending_subscription_plan
    end,
    subscription_status = v_status,
    subscription_current_period_end = coalesce(p_current_period_end, subscription_current_period_end),
    updated_at = now()
  where subscription_external_id = p_external_id;

  if not found then
    raise exception 'Suscripcion no encontrada';
  end if;
end;
$$;

create or replace function public.sync_business_subscription_payment(
  p_business_id uuid,
  p_status text,
  p_current_period_end timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_status = 'approved' then
    update public.businesses
    set
      subscription_provider = 'mercadopago',
      subscription_status = 'active',
      subscription_plan = coalesce(pending_subscription_plan, subscription_plan),
      pending_subscription_plan = null,
      subscription_current_period_end = coalesce(p_current_period_end, now() + interval '1 month'),
      updated_at = now()
    where id = p_business_id;
  elsif p_status in ('rejected', 'cancelled', 'refunded') then
    update public.businesses
    set
      subscription_provider = 'mercadopago',
      subscription_status = 'past_due',
      updated_at = now()
    where id = p_business_id
      and subscription_status <> 'active';
  end if;
end;
$$;

revoke insert, update on public.businesses from anon, authenticated;
grant insert (
  owner_id, name, slug, category, logo_url, brand_color, timezone, currency, is_public,
  payment_alias, payment_cbu, payment_instructions, description, logo_key,
  cover_image_url, cover_image_key, whatsapp_phone
) on public.businesses to authenticated;
grant update (
  name, slug, category, logo_url, brand_color, timezone, currency, is_public,
  payment_alias, payment_cbu, payment_instructions, description, logo_key,
  cover_image_url, cover_image_key, whatsapp_phone
) on public.businesses to authenticated;

revoke execute on function public.business_has_dashboard_access(uuid) from public;
revoke execute on function public.business_has_public_page_access(uuid) from public;
revoke execute on function public.business_has_booking_access(uuid) from public;
grant execute on function public.business_has_dashboard_access(uuid) to anon, authenticated;
grant execute on function public.business_has_public_page_access(uuid) to anon, authenticated;
grant execute on function public.business_has_booking_access(uuid) to anon, authenticated;

revoke execute on function public.sync_business_subscription_status(text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.sync_business_subscription_payment(uuid, text, timestamptz) from public, anon, authenticated;
