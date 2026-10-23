-- Citadely pasa a ser gratuito: el acceso ya no depende de prueba, plan, promoción ni período pago.
-- Se redefinen con la misma firma los helpers que usan las políticas RLS y las RPC, así que las
-- políticas de 20261015152323 siguen igual y quedan abiertas para el dueño. Las columnas y tablas de
-- suscripción se eliminan en 20261024120200, después del deploy; get_business_access_state no se toca acá.
-- Idempotente: solo create or replace y grants.

create or replace function public.business_has_dashboard_access(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = target_business_id
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
    select 1 from public.businesses b
    where b.id = target_business_id
      and b.is_public = true
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

create or replace function public.user_can_write_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.user_owns_business(target_business_id);
$$;

-- Mismos grants que hoy: las políticas públicas (rol anon) usan public_page_access y booking_access.
revoke all on function public.business_has_dashboard_access(uuid) from public, anon;
grant execute on function public.business_has_dashboard_access(uuid) to authenticated;
revoke all on function public.business_has_public_page_access(uuid) from public;
grant execute on function public.business_has_public_page_access(uuid) to anon, authenticated;
revoke all on function public.business_has_booking_access(uuid) from public;
grant execute on function public.business_has_booking_access(uuid) to anon, authenticated;
revoke all on function public.user_can_write_business(uuid) from public, anon;
grant execute on function public.user_can_write_business(uuid) to authenticated;

-- Cuerpo de 20261015152323 sin el chequeo de suscripción.
create or replace function public.confirm_appointment_deposit(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_appointment public.appointments%rowtype;
begin
  select * into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
    and a.status = 'pending_payment'
    and a.deposit_amount_cents > 0
    and public.user_owns_business(a.business_id)
  for update;

  if not found then
    raise exception 'Reserva pendiente no encontrada';
  end if;

  if v_appointment.deposit_expires_at is not null and v_appointment.deposit_expires_at <= now() then
    update public.appointments
    set status = 'cancelled',
        cancellation_reason = 'Seña no confirmada dentro del plazo',
        updated_at = now()
    where id = p_appointment_id;
    return;
  end if;

  update public.appointments
  set status = 'confirmed',
      deposit_confirmed_at = now(),
      deposit_confirmed_by = auth.uid(),
      updated_at = now()
  where id = p_appointment_id;
end;
$$;

revoke all on function public.confirm_appointment_deposit(uuid) from public, anon;
grant execute on function public.confirm_appointment_deposit(uuid) to authenticated;

-- Cuerpo de 20260910155921 con la autorización reducida a ser dueño del negocio.
create or replace function public.sync_business_public_sections(
  p_business_id uuid,
  p_gallery_images jsonb,
  p_faqs jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  ) then
    raise exception 'No autorizado';
  end if;

  if jsonb_typeof(coalesce(p_gallery_images, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Galeria invalida';
  end if;
  if jsonb_array_length(coalesce(p_gallery_images, '[]'::jsonb)) > 10 then
    raise exception 'La galeria admite hasta 10 fotos';
  end if;

  if jsonb_typeof(coalesce(p_faqs, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'FAQ invalida';
  end if;
  if jsonb_array_length(coalesce(p_faqs, '[]'::jsonb)) > 10 then
    raise exception 'FAQ admite hasta 10 preguntas';
  end if;

  delete from public.business_gallery_images where business_id = p_business_id;
  insert into public.business_gallery_images (business_id, image_url, image_key, sort_order)
  select
    p_business_id,
    btrim(item->>'image_url'),
    btrim(item->>'image_key'),
    (position - 1)::smallint
  from jsonb_array_elements(coalesce(p_gallery_images, '[]'::jsonb)) with ordinality as gallery(item, position);

  delete from public.business_faqs where business_id = p_business_id;
  insert into public.business_faqs (business_id, question, answer, sort_order)
  select
    p_business_id,
    btrim(item->>'question'),
    btrim(item->>'answer'),
    (position - 1)::smallint
  from jsonb_array_elements(coalesce(p_faqs, '[]'::jsonb)) with ordinality as faq(item, position);
end;
$$;

revoke all on function public.sync_business_public_sections(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.sync_business_public_sections(uuid, jsonb, jsonb) to authenticated;
