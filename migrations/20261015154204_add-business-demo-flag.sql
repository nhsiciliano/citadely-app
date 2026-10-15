-- Marca las cuentas de demostración en la base. El panel deja de inferirlo por slug o email.
alter table public.businesses add column if not exists is_demo boolean not null default false;

update public.businesses set is_demo = true where slug = 'citadely-demo-ux';
