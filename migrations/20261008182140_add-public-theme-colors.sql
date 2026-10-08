create function public.valid_public_theme(theme jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  section_name text;
  section_value jsonb;
  field_name text;
  field_value jsonb;
begin
  if theme is null or jsonb_typeof(theme) <> 'object' then
    return false;
  end if;

  for section_name, section_value in select key, value from jsonb_each(theme) loop
    if section_name not in ('header', 'hero', 'services', 'booking', 'gallery', 'info', 'faq')
      or jsonb_typeof(section_value) <> 'object' then
      return false;
    end if;

    for field_name, field_value in select key, value from jsonb_each(section_value) loop
      if field_name not in ('background', 'accent')
        or jsonb_typeof(field_value) <> 'string'
        or (field_value #>> '{}') !~ '^#[0-9a-fA-F]{6}$' then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

alter table public.businesses
  add column public_theme jsonb not null default '{}'::jsonb,
  add constraint businesses_public_theme_valid check (public.valid_public_theme(public_theme));

grant select (public_theme) on public.businesses to anon;
grant update (public_theme) on public.businesses to authenticated;
