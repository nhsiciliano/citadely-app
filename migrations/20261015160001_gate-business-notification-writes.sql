-- Las escrituras de notificaciones siguen el acceso del panel: una suscripción vencida queda en solo lectura.
-- La lectura se mantiene para el dueño, como antes.
drop policy if exists "owners manage own business notification settings" on public.business_notification_settings;

create policy "owners read business notification settings"
on public.business_notification_settings
for select
to authenticated
using (public.user_owns_business(business_id));

create policy "owners insert business notification settings"
on public.business_notification_settings
for insert
to authenticated
with check (public.user_can_write_business(business_id));

create policy "owners update business notification settings"
on public.business_notification_settings
for update
to authenticated
using (public.user_can_write_business(business_id))
with check (public.user_can_write_business(business_id));

create policy "owners delete business notification settings"
on public.business_notification_settings
for delete
to authenticated
using (public.user_can_write_business(business_id));
