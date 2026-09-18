-- Normalize the only legacy invalid representation before validating the new
-- booking input constraints. An empty phone carries the same meaning as NULL.
update public.clients
set phone = null
where phone is not null
  and btrim(phone) = '';

alter table public.clients validate constraint clients_name_length;
alter table public.clients validate constraint clients_email_length;
alter table public.clients validate constraint clients_phone_length;
alter table public.appointments validate constraint appointments_client_message_length;
