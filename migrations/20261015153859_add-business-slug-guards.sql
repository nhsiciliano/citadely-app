-- 3.2: slugs reservados (subdominios y rutas de la app) y chequeo de disponibilidad para el onboarding.
-- La lista debe coincidir con RESERVED_BUSINESS_SLUGS en lib/business-slug.ts.

create or replace function public.is_reserved_business_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select p_slug = any (array[
    'www', 'app', 'api', 'admin', 'admin-panel', 'blog', 'b', 'negocio', 'onboarding', 'login', 'registro',
    'cliente', 'auth', 'mail', 'email', 'smtp', 'ftp', 'ns1', 'ns2', 'status', 'support', 'soporte', 'ayuda',
    'help', 'docs', 'static', 'assets', 'cdn', 'dev', 'staging', 'test', 'preview', 'citadely', 'root',
    'dashboard', 'panel', 'billing', 'pagos', 'webhook', 'webhooks', 'cron', 'sitemap', 'robots',
    'verificar-email', 'recuperar-password', 'politica-de-privacidad', 'condiciones-del-servicio',
    'contacto', 'precios'
  ]);
$$;

-- NOT VALID: no revisa los negocios existentes, solo altas y cambios nuevos.
alter table public.businesses
  add constraint businesses_slug_not_reserved check (not public.is_reserved_business_slug(slug)) not valid;

alter table public.businesses
  add constraint businesses_slug_min_length check (char_length(slug) >= 3) not valid;

-- true si el slug es valido, no esta reservado y no lo usa el negocio de otra persona.
-- SECURITY DEFINER porque RLS oculta los negocios ajenos; solo devuelve un booleano.
create or replace function public.is_business_slug_available(p_slug text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
begin
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or pg_catalog.char_length(v_slug) not between 3 and 60
    or public.is_reserved_business_slug(v_slug) then
    return false;
  end if;

  return not exists (
    select 1 from public.businesses b
    where b.slug = v_slug and b.owner_id is distinct from auth.uid()
  );
end;
$$;

revoke all on function public.is_business_slug_available(text) from public, anon;
grant execute on function public.is_business_slug_available(text) to authenticated;
