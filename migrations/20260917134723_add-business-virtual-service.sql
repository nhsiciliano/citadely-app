alter table public.businesses
  add column if not exists service_mode text not null default 'physical',
  add column if not exists virtual_platforms text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_service_mode_check'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_service_mode_check
      check (service_mode in ('physical', 'virtual'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_virtual_platforms_check'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_virtual_platforms_check
      check (
        virtual_platforms <@ array['zoom', 'google_meet', 'microsoft_teams']::text[]
        and cardinality(virtual_platforms) <= 3
        and (service_mode <> 'virtual' or cardinality(virtual_platforms) > 0)
      );
  end if;
end;
$$;

grant update (service_mode, virtual_platforms) on public.businesses to authenticated;
