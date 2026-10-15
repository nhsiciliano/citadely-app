-- Índices para las columnas que referencian turnos y usuarios: filtros por esas columnas y
-- chequeos de FK al borrar un turno o un usuario sin recorrer toda la tabla.
create index if not exists email_outbox_appointment_id_idx on public.email_outbox (appointment_id);
create index if not exists email_outbox_user_id_idx on public.email_outbox (user_id);
