-- Suscripción vencida = solo lectura. El dueño sigue leyendo todo lo de su negocio, pero
-- insertar, editar o borrar exige acceso vigente (prueba, promoción o período pago).
-- Las rutas de pago escriben con la key de servidor (project_admin) y no pasan por estas políticas;
-- las columnas de facturación de businesses ya no tienen grant de UPDATE para authenticated.
--
-- Nombres de política estables (los referencia la matriz RLS de 7.3):
--   services, service_availability_slots, clients, appointments:
--     "owners read <t>" / "owners insert <t>" / "owners update <t>" / "owners delete <t>"
--     con <t> = services | service availability slots | clients | appointments
--   employees, working_hours, time_off, reminders, appointment_notes:
--     "owners read <t>" (select) / "owners write <t>" (all, con acceso vigente)
--     con <t> = employees | working hours | time off | reminders | appointment notes
--   businesses: "owners read own business" / "owners create own business" /
--     "owners update own business" / "owners delete own business"
-- Sin cambios: políticas públicas, de rol cliente, business_gallery_images y business_faqs
-- (escriben por sync_business_public_sections) y business_notification_settings (ver 3.5).

create or replace function public.user_can_write_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.user_owns_business(target_business_id)
    and public.business_has_dashboard_access(target_business_id);
$$;

revoke all on function public.user_can_write_business(uuid) from public, anon;
grant execute on function public.user_can_write_business(uuid) to authenticated;

-- Tablas del negocio: lectura del dueño sin cambios; escritura con acceso vigente.
drop policy if exists "owners manage services" on public.services;
create policy "owners read services" on public.services
  for select to authenticated using (public.user_owns_business(business_id));
create policy "owners insert services" on public.services
  for insert to authenticated with check (public.user_can_write_business(business_id));
create policy "owners update services" on public.services
  for update to authenticated
  using (public.user_can_write_business(business_id))
  with check (public.user_can_write_business(business_id));
create policy "owners delete services" on public.services
  for delete to authenticated using (public.user_can_write_business(business_id));

drop policy if exists "owners manage service availability slots" on public.service_availability_slots;
create policy "owners read service availability slots" on public.service_availability_slots
  for select to authenticated using (public.user_owns_business(business_id));
create policy "owners insert service availability slots" on public.service_availability_slots
  for insert to authenticated
  with check (
    public.user_can_write_business(business_id)
    and exists (
      select 1 from public.services s
      where s.id = service_availability_slots.service_id
        and s.business_id = service_availability_slots.business_id
    )
  );
create policy "owners update service availability slots" on public.service_availability_slots
  for update to authenticated
  using (public.user_can_write_business(business_id))
  with check (
    public.user_can_write_business(business_id)
    and exists (
      select 1 from public.services s
      where s.id = service_availability_slots.service_id
        and s.business_id = service_availability_slots.business_id
    )
  );
create policy "owners delete service availability slots" on public.service_availability_slots
  for delete to authenticated using (public.user_can_write_business(business_id));

drop policy if exists "owners manage clients" on public.clients;
create policy "owners read clients" on public.clients
  for select to authenticated using (public.user_owns_business(business_id));
create policy "owners insert clients" on public.clients
  for insert to authenticated with check (public.user_can_write_business(business_id));
create policy "owners update clients" on public.clients
  for update to authenticated
  using (public.user_can_write_business(business_id))
  with check (public.user_can_write_business(business_id));
create policy "owners delete clients" on public.clients
  for delete to authenticated using (public.user_can_write_business(business_id));

drop policy if exists "owners manage appointments" on public.appointments;
create policy "owners read appointments" on public.appointments
  for select to authenticated using (public.user_owns_business(business_id));
create policy "owners insert appointments" on public.appointments
  for insert to authenticated with check (public.user_can_write_business(business_id));
create policy "owners update appointments" on public.appointments
  for update to authenticated
  using (public.user_can_write_business(business_id))
  with check (public.user_can_write_business(business_id));
create policy "owners delete appointments" on public.appointments
  for delete to authenticated using (public.user_can_write_business(business_id));

-- Tablas heredadas sin uso en la app: mismo criterio para que no quede un camino de escritura.
drop policy if exists "owners manage employees" on public.employees;
create policy "owners read employees" on public.employees
  for select to authenticated using (public.user_owns_business(business_id));
create policy "owners write employees" on public.employees
  for all to authenticated
  using (public.user_can_write_business(business_id))
  with check (public.user_can_write_business(business_id));

drop policy if exists "owners manage working hours" on public.working_hours;
create policy "owners read working hours" on public.working_hours
  for select to authenticated using (public.user_owns_business(business_id));
create policy "owners write working hours" on public.working_hours
  for all to authenticated
  using (public.user_can_write_business(business_id))
  with check (public.user_can_write_business(business_id));

drop policy if exists "owners manage time off" on public.time_off;
create policy "owners read time off" on public.time_off
  for select to authenticated using (public.user_owns_business(business_id));
create policy "owners write time off" on public.time_off
  for all to authenticated
  using (public.user_can_write_business(business_id))
  with check (public.user_can_write_business(business_id));

drop policy if exists "owners manage reminders" on public.reminders;
create policy "owners read reminders" on public.reminders
  for select to authenticated using (public.user_owns_business(business_id));
create policy "owners write reminders" on public.reminders
  for all to authenticated
  using (public.user_can_write_business(business_id))
  with check (public.user_can_write_business(business_id));

drop policy if exists "owners manage appointment notes" on public.appointment_notes;
create policy "owners read appointment notes" on public.appointment_notes
  for select to authenticated using (public.user_owns_business(business_id));
create policy "owners write appointment notes" on public.appointment_notes
  for all to authenticated
  using (public.user_can_write_business(business_id))
  with check (public.user_can_write_business(business_id));

-- businesses: leer y crear (onboarding, alta inicial en prueba) siguen libres para el dueño;
-- editar o borrar exige acceso vigente. El acceso se evalúa sobre la fila previa (USING).
drop policy if exists "owners manage own business" on public.businesses;
create policy "owners read own business" on public.businesses
  for select to authenticated using (owner_id = auth.uid());
create policy "owners create own business" on public.businesses
  for insert to authenticated with check (owner_id = auth.uid());
create policy "owners update own business" on public.businesses
  for update to authenticated
  using (owner_id = auth.uid() and public.business_has_dashboard_access(id))
  with check (owner_id = auth.uid());
create policy "owners delete own business" on public.businesses
  for delete to authenticated
  using (owner_id = auth.uid() and public.business_has_dashboard_access(id));

-- Única RPC de escritura ejecutable por authenticated que no exigía acceso vigente.
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

  if not public.business_has_dashboard_access(v_appointment.business_id) then
    raise exception 'Tu suscripción no está activa. Activá un plan para confirmar señas.';
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

-- Estado de acceso calculado en el servidor: única fuente para el dashboard y las rutas de pago.
-- has_dashboard_access y public_page_published usan los mismos helpers que las políticas RLS.
create or replace function public.get_business_access_state(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_has_dashboard_access boolean;
  v_is_trialing boolean;
  v_has_promotion boolean;
  v_promotion_pending boolean;
  v_has_paid_period boolean;
  v_billing_start_at timestamptz;
begin
  if auth.uid() is not null and not public.user_owns_business(p_business_id) then
    raise exception 'No autorizado';
  end if;

  select * into v_business from public.businesses b where b.id = p_business_id;
  if not found then
    raise exception 'Negocio no encontrado';
  end if;

  v_has_dashboard_access := public.business_has_dashboard_access(p_business_id);
  v_is_trialing := coalesce(v_business.subscription_status = 'trialing' and v_business.trial_ends_at > v_now, false);
  v_has_promotion := coalesce(v_business.promotion_starts_at <= v_now and v_business.promotion_ends_at > v_now, false);
  v_promotion_pending := coalesce(v_business.promotion_starts_at > v_now and v_business.promotion_ends_at > v_now, false);
  v_has_paid_period := case
    when v_business.subscription_provider = 'mercadopago' then coalesce(
      v_business.subscription_status in ('active', 'past_due', 'cancelled')
        and v_business.subscription_current_period_end > v_now,
      false
    )
    else v_business.subscription_status = 'active'
  end;
  v_billing_start_at := greatest(
    v_business.promotion_ends_at,
    case when v_business.subscription_status = 'trialing' then v_business.trial_ends_at end,
    case when v_business.subscription_cancel_at_period_end then v_business.subscription_current_period_end end
  );

  return jsonb_build_object(
    'business_id', v_business.id,
    'server_now', v_now,
    'has_dashboard_access', v_has_dashboard_access,
    'needs_payment', not v_has_dashboard_access,
    'has_pro_features', v_has_promotion or ((v_is_trialing or v_has_paid_period) and coalesce(v_business.subscription_plan, 'pro') = 'pro'),
    'public_page_published', public.business_has_public_page_access(p_business_id),
    'current_plan', coalesce(v_business.subscription_plan, 'pro'),
    'pending_plan', v_business.pending_subscription_plan,
    'is_trialing', v_is_trialing,
    'trial_ends_at', v_business.trial_ends_at,
    'trial_days_left', coalesce(greatest(0, ceil(extract(epoch from (v_business.trial_ends_at - v_now)) / 86400))::integer, 0),
    'has_promotion', v_has_promotion,
    'promotion_pending', v_promotion_pending,
    'promotion_starts_at', v_business.promotion_starts_at,
    'promotion_ends_at', v_business.promotion_ends_at,
    'has_paid_period', v_has_paid_period,
    'period_ends_at', v_business.subscription_current_period_end,
    'cancel_at_period_end', coalesce(v_business.subscription_cancel_at_period_end, false),
    'is_past_due', coalesce(v_business.subscription_status = 'past_due', false),
    'awaiting_first_payment', v_business.subscription_external_id is not null
      and v_business.pending_subscription_plan is not null
      and not v_has_paid_period,
    'billing_start_at', case when v_billing_start_at > v_now then v_billing_start_at end
  );
end;
$$;

revoke all on function public.get_business_access_state(uuid) from public, anon;
grant execute on function public.get_business_access_state(uuid) to authenticated;
