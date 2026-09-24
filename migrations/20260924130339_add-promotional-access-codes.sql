alter table public.businesses
  add column promotion_starts_at timestamptz,
  add column promotion_ends_at timestamptz,
  add constraint businesses_promotion_window_check check (
    (promotion_starts_at is null and promotion_ends_at is null)
    or (promotion_starts_at is not null and promotion_ends_at > promotion_starts_at)
  );

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  code_hint text not null check (code_hint ~ '^[A-F0-9]{4}$'),
  duration_days integer not null check (duration_days between 1 and 365),
  max_uses integer not null check (max_uses between 1 and 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.promo_codes(id),
  business_id uuid unique references public.businesses(id) on delete set null,
  user_id uuid unique references auth.users(id) on delete set null,
  email_normalized text not null unique check (email_normalized = lower(btrim(email_normalized))),
  duration_days integer not null check (duration_days between 1 and 365),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  created_at timestamptz not null default now()
);

create index promo_redemptions_code_id_idx on public.promo_redemptions(code_id);

create table public.promo_redemption_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index promo_redemption_attempts_user_time_idx
  on public.promo_redemption_attempts(user_id, attempted_at desc);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.promo_redemption_attempts enable row level security;
revoke all on public.promo_codes from public, anon, authenticated;
revoke all on public.promo_redemptions from public, anon, authenticated;
revoke all on public.promo_redemption_attempts from public, anon, authenticated;
revoke all on sequence public.promo_redemption_attempts_id_seq from public, anon, authenticated;

create or replace function public.list_promo_codes()
returns table(
  id uuid,
  code_hint text,
  duration_days integer,
  max_uses integer,
  uses integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select c.id, c.code_hint, c.duration_days, c.max_uses,
    count(r.id)::integer as uses, c.is_active, c.created_at, c.updated_at
  from public.promo_codes c
  left join public.promo_redemptions r on r.code_id = c.id
  group by c.id
  order by c.created_at desc;
$$;

create or replace function public.update_promo_code(
  p_id uuid,
  p_duration_days integer,
  p_max_uses integer,
  p_is_active boolean
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_code public.promo_codes%rowtype;
  v_uses integer;
begin
  if p_duration_days not between 1 and 365
    or p_max_uses not between 1 and 1000
    or p_is_active is null then
    raise exception 'Configuracion de codigo invalida';
  end if;

  select * into v_code from public.promo_codes where id = p_id for update;
  if not found then raise exception 'Codigo no encontrado'; end if;

  select count(*) into v_uses from public.promo_redemptions where code_id = p_id;
  if p_max_uses < v_uses then
    raise exception 'El cupo no puede ser menor a los usos realizados';
  end if;

  update public.promo_codes
  set duration_days = p_duration_days, max_uses = p_max_uses,
      is_active = p_is_active, updated_at = now()
  where id = p_id;
end;
$$;

create or replace function public.claim_promo_redemption_attempt(p_user_id uuid)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_attempts integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 20260924));
  delete from public.promo_redemption_attempts
  where user_id = p_user_id and attempted_at < now() - interval '15 minutes';
  select count(*) into v_attempts from public.promo_redemption_attempts
  where user_id = p_user_id and attempted_at >= now() - interval '15 minutes';
  if v_attempts >= 10 then return false; end if;
  insert into public.promo_redemption_attempts(user_id) values (p_user_id);
  return true;
end;
$$;

create or replace function public.redeem_promo_code(
  p_business_id uuid,
  p_user_id uuid,
  p_code_hash text
)
returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_code public.promo_codes%rowtype;
  v_email text;
  v_now timestamptz := now();
  v_uses integer;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
begin
  select lower(btrim(u.email)) into v_email
  from auth.users u
  where u.id = p_user_id and u.email_verified = true and u.is_anonymous = false;
  if v_email is null or v_email = '' then
    raise exception 'Verifica tu email antes de canjear un codigo';
  end if;

  -- Serializa canjes del mismo negocio.
  select * into v_business
  from public.businesses b
  where b.id = p_business_id and b.owner_id = p_user_id
  for update;
  if not found then raise exception 'Negocio no encontrado'; end if;

  if exists (
    select 1 from public.promo_redemptions r
    where r.user_id = p_user_id or r.email_normalized = v_email
  ) then
    raise exception 'Este email ya canjeo un codigo';
  end if;

  if (
    v_business.subscription_current_period_end > v_now
    and v_business.subscription_status in ('active', 'past_due', 'cancelled')
  ) or (
    v_business.subscription_status = 'active'
    and v_business.subscription_provider is distinct from 'mercadopago'
  ) or (
    v_business.subscription_external_id is not null
    and not v_business.subscription_cancel_at_period_end
  ) then
    raise exception 'Cancela la suscripcion y espera al fin del periodo pago antes de canjear';
  end if;

  if exists (
    select 1 from public.subscription_operations o
    where o.business_id = p_business_id and o.status = 'processing'
      and o.lease_expires_at > v_now
  ) then
    raise exception 'Hay un cambio de suscripcion en curso';
  end if;

  select * into v_code from public.promo_codes
  where code_hash = p_code_hash and is_active = true
  for update;
  if not found then raise exception 'Codigo invalido o agotado'; end if;

  select count(*) into v_uses from public.promo_redemptions where code_id = v_code.id;
  if v_uses >= v_code.max_uses then raise exception 'Codigo invalido o agotado'; end if;

  v_starts_at := case
    when v_business.subscription_status = 'trialing' and v_business.trial_ends_at > v_now
      then v_business.trial_ends_at
    else v_now
  end;
  v_ends_at := v_starts_at + make_interval(days => v_code.duration_days);

  insert into public.promo_redemptions(
    code_id, business_id, user_id, email_normalized, duration_days, starts_at, ends_at
  ) values (
    v_code.id, p_business_id, p_user_id, v_email, v_code.duration_days, v_starts_at, v_ends_at
  );

  update public.businesses
  set promotion_starts_at = v_starts_at, promotion_ends_at = v_ends_at
  where id = p_business_id;

  return query select v_starts_at, v_ends_at;
end;
$$;

create or replace function public.business_has_dashboard_access(target_business_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = target_business_id
      and (
        (b.promotion_starts_at <= now() and b.promotion_ends_at > now())
        or (b.subscription_status = 'trialing' and b.trial_ends_at > now())
        or (
          b.subscription_provider = 'mercadopago'
          and b.subscription_status in ('active', 'past_due', 'cancelled')
          and b.subscription_current_period_end > now()
        )
        or (b.subscription_status = 'active' and b.subscription_provider is distinct from 'mercadopago')
      )
  );
$$;

create or replace function public.business_has_public_page_access(target_business_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = target_business_id and b.is_public = true
      and (
        (b.promotion_starts_at <= now() and b.promotion_ends_at > now())
        or (
          b.subscription_plan = 'pro'
          and public.business_has_dashboard_access(b.id)
        )
      )
  );
$$;

create or replace function public.sync_business_public_sections(
  p_business_id uuid, p_gallery_images jsonb, p_faqs jsonb
)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
      and public.business_has_dashboard_access(b.id)
      and (
        b.subscription_plan = 'pro'
        or (b.promotion_starts_at <= now() and b.promotion_ends_at > now())
      )
  ) then raise exception 'No autorizado'; end if;

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
  select p_business_id, btrim(item->>'image_url'), btrim(item->>'image_key'), (position - 1)::smallint
  from jsonb_array_elements(coalesce(p_gallery_images, '[]'::jsonb)) with ordinality as gallery(item, position);

  delete from public.business_faqs where business_id = p_business_id;
  insert into public.business_faqs (business_id, question, answer, sort_order)
  select p_business_id, btrim(item->>'question'), btrim(item->>'answer'), (position - 1)::smallint
  from jsonb_array_elements(coalesce(p_faqs, '[]'::jsonb)) with ordinality as faq(item, position);
end;
$$;

revoke execute on function public.list_promo_codes() from public, anon, authenticated;
revoke execute on function public.update_promo_code(uuid, integer, integer, boolean) from public, anon, authenticated;
revoke execute on function public.claim_promo_redemption_attempt(uuid) from public, anon, authenticated;
revoke execute on function public.redeem_promo_code(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.business_has_dashboard_access(uuid) from public, anon;
revoke execute on function public.business_has_public_page_access(uuid) from public;
