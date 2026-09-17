create table public.business_gallery_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  image_url text not null,
  image_key text not null,
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  constraint business_gallery_images_url_not_blank check (btrim(image_url) <> ''),
  constraint business_gallery_images_key_not_blank check (btrim(image_key) <> ''),
  constraint business_gallery_images_sort_order_check check (sort_order between 0 and 9),
  constraint business_gallery_images_position_unique unique (business_id, sort_order)
);

create table public.business_faqs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  question text not null,
  answer text not null,
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_faqs_question_length check (char_length(btrim(question)) between 1 and 180),
  constraint business_faqs_answer_length check (char_length(btrim(answer)) between 1 and 1200),
  constraint business_faqs_sort_order_check check (sort_order between 0 and 9),
  constraint business_faqs_position_unique unique (business_id, sort_order)
);

create index business_gallery_images_business_id_idx
  on public.business_gallery_images(business_id);

create index business_faqs_business_id_idx
  on public.business_faqs(business_id);

create trigger business_faqs_updated_at
before update on public.business_faqs
for each row execute function public.set_updated_at();

alter table public.business_gallery_images enable row level security;
alter table public.business_faqs enable row level security;

create policy "public can read gallery images"
on public.business_gallery_images
for select to anon, authenticated
using (public.business_has_public_page_access(business_id));

create policy "owners can read gallery images"
on public.business_gallery_images
for select to authenticated
using (public.user_owns_business(business_id));

create policy "public can read faqs"
on public.business_faqs
for select to anon, authenticated
using (public.business_has_public_page_access(business_id));

create policy "owners can read faqs"
on public.business_faqs
for select to authenticated
using (public.user_owns_business(business_id));

create or replace function public.sync_business_public_sections(
  p_business_id uuid,
  p_gallery_images jsonb,
  p_faqs jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
      and (
        (b.subscription_status = 'trialing' and b.trial_ends_at > now())
        or (b.subscription_status = 'active' and b.subscription_plan = 'pro')
      )
  ) then
    raise exception 'No autorizado';
  end if;

  if jsonb_typeof(coalesce(p_gallery_images, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Galeria invalida';
  end if;
  if jsonb_array_length(coalesce(p_gallery_images, '[]'::jsonb)) > 10 then
    raise exception 'La galeria admite hasta 10 fotos';
  end if;

  if jsonb_typeof(coalesce(p_faqs, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'FAQ invalida';
  end if;
  if jsonb_array_length(coalesce(p_faqs, '[]'::jsonb)) > 10 then
    raise exception 'FAQ admite hasta 10 preguntas';
  end if;

  delete from public.business_gallery_images where business_id = p_business_id;
  insert into public.business_gallery_images (business_id, image_url, image_key, sort_order)
  select
    p_business_id,
    btrim(item->>'image_url'),
    btrim(item->>'image_key'),
    (position - 1)::smallint
  from jsonb_array_elements(coalesce(p_gallery_images, '[]'::jsonb)) with ordinality as gallery(item, position);

  delete from public.business_faqs where business_id = p_business_id;
  insert into public.business_faqs (business_id, question, answer, sort_order)
  select
    p_business_id,
    btrim(item->>'question'),
    btrim(item->>'answer'),
    (position - 1)::smallint
  from jsonb_array_elements(coalesce(p_faqs, '[]'::jsonb)) with ordinality as faq(item, position);
end;
$$;

revoke all on public.business_gallery_images from anon, authenticated;
revoke all on public.business_faqs from anon, authenticated;

grant select on public.business_gallery_images to anon, authenticated;
grant select on public.business_faqs to anon, authenticated;

revoke execute on function public.sync_business_public_sections(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.sync_business_public_sections(uuid, jsonb, jsonb) to authenticated;
