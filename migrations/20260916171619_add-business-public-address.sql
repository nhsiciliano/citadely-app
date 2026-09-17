alter table public.businesses
  add column if not exists public_address text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_public_address_length'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_public_address_length
      check (public_address is null or char_length(btrim(public_address)) between 1 and 300);
  end if;
end;
$$;

grant update (public_address) on public.businesses to authenticated;
