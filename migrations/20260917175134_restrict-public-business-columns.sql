revoke select on public.businesses from public, anon, authenticated;

grant select (
  id,
  name,
  slug,
  category,
  description,
  payment_alias,
  payment_cbu,
  payment_instructions,
  whatsapp_phone,
  public_address,
  service_mode,
  virtual_platforms,
  logo_url,
  cover_image_url,
  brand_color,
  currency,
  timezone,
  is_public
) on public.businesses to anon;

grant select on public.businesses to authenticated;

drop policy if exists "public can read public businesses" on public.businesses;
create policy "public can read public businesses"
on public.businesses
for select
to anon
using (public.business_has_public_page_access(id));
