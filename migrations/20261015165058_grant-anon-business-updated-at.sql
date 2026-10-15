-- El sitemap lee businesses.updated_at con la anon key para el lastModified de cada página pública.
-- Se otorga solo esa columna: la lista de columnas públicas de 20260917175134 no la incluía.
-- Las filas siguen filtradas por la política "public can read public businesses".
grant select (updated_at) on public.businesses to anon;
