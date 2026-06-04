create policy "anon can create booking clients"
on public.clients
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.is_public = true
  )
);

create policy "anon can create booking appointments"
on public.appointments
for insert
to anon, authenticated
with check (
  source = 'public_booking'
  and status in ('confirmed', 'pending_payment')
  and exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.is_public = true
  )
  and exists (
    select 1
    from public.services s
    where s.id = service_id
      and s.business_id = appointments.business_id
      and s.is_active = true
  )
);

create policy "anon can create pending booking payments"
on public.payments
for insert
to anon, authenticated
with check (
  provider = 'mercadopago'
  and provider_environment = 'sandbox'
  and status = 'pending'
  and exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.is_public = true
  )
);
