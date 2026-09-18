-- Public pages read only the explicitly public catalog/profile tables. Keep
-- private operational and customer data unreachable at the SQL privilege layer
-- in addition to its existing RLS deny-by-default protection.
revoke select on public.appointment_notes from anon;
revoke select on public.appointments from anon;
revoke select on public.business_notification_settings from anon;
revoke select on public.clients from anon;
revoke select on public.payments from anon;
revoke select on public.reminders from anon;
revoke select on public.time_off from anon;
