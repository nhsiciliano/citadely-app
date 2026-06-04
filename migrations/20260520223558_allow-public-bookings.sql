create policy "public can create booking clients"
on public.clients
for insert
to public
with check (
  user_id is null
  and exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.is_public = true
  )
);

create policy "public can create booking appointments"
on public.appointments
for insert
to public
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
    from public.clients c
    where c.id = client_id
      and c.business_id = appointments.business_id
  )
  and exists (
    select 1
    from public.services s
    where s.id = service_id
      and s.business_id = appointments.business_id
      and s.is_active = true
  )
);

create policy "public can create pending booking payments"
on public.payments
for insert
to public
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
  and exists (
    select 1
    from public.appointments a
    where a.id = appointment_id
      and a.business_id = payments.business_id
      and a.status = 'pending_payment'
      and a.source = 'public_booking'
  )
);
