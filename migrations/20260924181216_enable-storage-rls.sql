-- Existing business-assets policies already limit authenticated writes to the
-- owning business. Enabling RLS also denies direct user writes to blog-assets;
-- its admin-only upload endpoint uses the project API key and bypasses RLS.
do $$
begin
  if (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'business_assets_public_read',
        'business_assets_owner_insert',
        'business_assets_owner_update',
        'business_assets_owner_delete'
      )
  ) <> 4 then
    raise exception 'Expected business-assets storage policies are missing';
  end if;
end;
$$;

alter table storage.objects enable row level security;
