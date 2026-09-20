create or replace function public.build_appointment_email_payload(p_appointment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select jsonb_build_object(
    'appointmentId', a.id,
    'status', a.status,
    'startsAt', a.starts_at,
    'endsAt', a.ends_at,
    'updatedAt', a.updated_at,
    'depositAmountCents', a.deposit_amount_cents,
    'depositExpiresAt', a.deposit_expires_at,
    'depositConfirmedAt', a.deposit_confirmed_at,
    'cancellationReason', a.cancellation_reason,
    'clientMessage', a.client_message,
    'client', jsonb_build_object(
      'name', c.name,
      'email', c.email,
      'phone', c.phone
    ),
    'service', jsonb_build_object(
      'name', s.name,
      'description', s.description,
      'durationMinutes', s.duration_minutes,
      'priceCents', s.price_cents,
      'depositType', s.deposit_type
    ),
    'business', jsonb_build_object(
      'name', b.name,
      'slug', b.slug,
      'timezone', b.timezone,
      'currency', b.currency,
      'logoUrl', b.logo_url,
      'publicAddress', b.public_address,
      'serviceMode', b.service_mode,
      'virtualPlatforms', b.virtual_platforms,
      'paymentAlias', b.payment_alias,
      'paymentCbu', b.payment_cbu,
      'paymentInstructions', b.payment_instructions,
      'notificationEmail', n.email
    )
  )
  from public.appointments a
  join public.clients c on c.id = a.client_id
  join public.services s on s.id = a.service_id
  join public.businesses b on b.id = a.business_id
  left join public.business_notification_settings n on n.business_id = b.id
  where a.id = p_appointment_id;
$$;

revoke execute on function public.build_appointment_email_payload(uuid) from public, anon, authenticated;
