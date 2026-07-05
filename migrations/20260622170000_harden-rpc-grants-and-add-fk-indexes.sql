create index if not exists working_hours_employee_id_idx
  on public.working_hours(employee_id);

create index if not exists time_off_business_id_idx
  on public.time_off(business_id);

create index if not exists time_off_employee_id_idx
  on public.time_off(employee_id);

create index if not exists appointments_employee_id_idx
  on public.appointments(employee_id);

create index if not exists appointments_service_id_idx
  on public.appointments(service_id);

create index if not exists appointments_deposit_confirmed_by_idx
  on public.appointments(deposit_confirmed_by);

create index if not exists appointment_notes_appointment_id_idx
  on public.appointment_notes(appointment_id);

create index if not exists appointment_notes_business_id_idx
  on public.appointment_notes(business_id);

create index if not exists appointment_notes_created_by_idx
  on public.appointment_notes(created_by);

create index if not exists payments_appointment_id_idx
  on public.payments(appointment_id);

create index if not exists reminders_appointment_id_idx
  on public.reminders(appointment_id);

create index if not exists reminders_business_id_idx
  on public.reminders(business_id);

revoke execute on function public.user_owns_business(uuid) from public;
grant execute on function public.user_owns_business(uuid) to authenticated;

revoke execute on function public.user_is_appointment_client(uuid) from public;
grant execute on function public.user_is_appointment_client(uuid) to authenticated;

revoke execute on function public.business_has_booking_access(uuid) from public;
grant execute on function public.business_has_booking_access(uuid) to anon, authenticated;

revoke execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text) from public;
grant execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text, text) to anon, authenticated;

revoke execute on function public.confirm_appointment_deposit(uuid) from public;
grant execute on function public.confirm_appointment_deposit(uuid) to authenticated;

revoke execute on function public.set_business_subscription_checkout(uuid, text, text) from public;
grant execute on function public.set_business_subscription_checkout(uuid, text, text) to authenticated;

revoke execute on function public.cancel_expired_deposit_bookings() from public;

revoke execute on function public.sync_business_subscription_status(text, text, timestamptz) from public;

revoke execute on function public.sync_business_subscription_payment(uuid, text, timestamptz) from public;

revoke execute on function public.confirm_mercadopago_payment(uuid, text, text) from public;

revoke execute on function public.get_mercadopago_checkout_data(uuid) from public;

revoke execute on function public.set_mercadopago_checkout_preference(uuid, text, text) from public;
