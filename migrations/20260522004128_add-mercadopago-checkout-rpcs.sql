create or replace function public.get_mercadopago_checkout_data(p_payment_id uuid)
returns table(
  payment_id uuid,
  appointment_id uuid,
  amount_cents integer,
  payment_status text,
  business_name text,
  business_slug text,
  service_name text,
  client_name text,
  client_email text,
  starts_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    a.id,
    p.amount_cents,
    p.status,
    b.name,
    b.slug,
    s.name,
    c.name,
    c.email,
    a.starts_at
  from public.payments p
  join public.appointments a on a.id = p.appointment_id
  join public.businesses b on b.id = p.business_id
  join public.services s on s.id = a.service_id
  join public.clients c on c.id = a.client_id
  where p.id = p_payment_id
    and p.provider = 'mercadopago'
    and p.provider_environment = 'sandbox'
    and p.status = 'pending'
    and p.amount_cents > 0
    and a.status = 'pending_payment'
    and b.is_public = true
  limit 1;
$$;

create or replace function public.set_mercadopago_checkout_preference(
  p_payment_id uuid,
  p_preference_id text,
  p_checkout_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payments
  set
    external_id = p_preference_id,
    checkout_url = p_checkout_url,
    updated_at = now()
  where id = p_payment_id
    and provider = 'mercadopago'
    and provider_environment = 'sandbox'
    and status = 'pending';

  if not found then
    raise exception 'Pago pendiente no encontrado';
  end if;
end;
$$;

create or replace function public.confirm_mercadopago_payment(
  p_payment_id uuid,
  p_external_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized_status text;
begin
  v_normalized_status := case p_status
    when 'approved' then 'approved'
    when 'rejected' then 'rejected'
    when 'cancelled' then 'cancelled'
    when 'refunded' then 'refunded'
    else 'pending'
  end;

  update public.payments
  set
    external_id = coalesce(p_external_id, external_id),
    status = v_normalized_status,
    paid_at = case when v_normalized_status = 'approved' then now() else paid_at end,
    updated_at = now()
  where id = p_payment_id
    and provider = 'mercadopago'
    and provider_environment = 'sandbox';

  if not found then
    raise exception 'Pago no encontrado';
  end if;

  if v_normalized_status = 'approved' then
    update public.appointments a
    set status = 'confirmed', updated_at = now()
    from public.payments p
    where p.id = p_payment_id
      and a.id = p.appointment_id
      and a.status = 'pending_payment';
  end if;
end;
$$;

grant execute on function public.get_mercadopago_checkout_data(uuid) to anon, authenticated;
grant execute on function public.set_mercadopago_checkout_preference(uuid, text, text) to anon, authenticated;
grant execute on function public.confirm_mercadopago_payment(uuid, text, text) to anon, authenticated;
