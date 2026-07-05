alter table public.businesses
  add column if not exists description text,
  add column if not exists logo_key text,
  add column if not exists cover_image_url text,
  add column if not exists cover_image_key text;

grant usage on schema storage to anon, authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

drop policy if exists business_assets_public_read on storage.objects;
create policy business_assets_public_read
on storage.objects
for select
to anon, authenticated
using (bucket = 'business-assets');

drop policy if exists business_assets_owner_insert on storage.objects;
create policy business_assets_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket = 'business-assets'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(key))[1]
      and b.owner_id = auth.uid()
  )
);

drop policy if exists business_assets_owner_update on storage.objects;
create policy business_assets_owner_update
on storage.objects
for update
to authenticated
using (
  bucket = 'business-assets'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(key))[1]
      and b.owner_id = auth.uid()
  )
)
with check (
  bucket = 'business-assets'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(key))[1]
      and b.owner_id = auth.uid()
  )
);

drop policy if exists business_assets_owner_delete on storage.objects;
create policy business_assets_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket = 'business-assets'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(key))[1]
      and b.owner_id = auth.uid()
  )
);
