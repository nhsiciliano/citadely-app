create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  slug text not null unique,
  cover_url text,
  cover_key text,
  cover_alt text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint blog_posts_title_length check (char_length(title) <= 180),
  constraint blog_posts_alt_length check (char_length(cover_alt) <= 240),
  constraint blog_posts_published_complete check (
    status = 'draft' or (
      nullif(btrim(title), '') is not null
      and nullif(btrim(cover_url), '') is not null
      and nullif(btrim(cover_key), '') is not null
      and nullif(btrim(cover_alt), '') is not null
      and published_at is not null
    )
  )
);

create table public.blog_post_blocks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  position integer not null check (position >= 0),
  kind text not null check (kind in ('heading2', 'heading3', 'paragraph', 'ordered_list', 'unordered_list', 'quote')),
  content text not null check (char_length(content) between 1 and 10000),
  constraint blog_post_blocks_position_unique unique (post_id, position)
);

create table public.blog_admin_login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);

create index blog_posts_published_idx on public.blog_posts (published_at desc, id desc) where status = 'published';
create index blog_post_blocks_post_position_idx on public.blog_post_blocks (post_id, position);
create index blog_admin_login_attempts_window_idx on public.blog_admin_login_attempts (ip_hash, attempted_at desc);

create trigger blog_posts_updated_at before update on public.blog_posts
  for each row execute function public.set_updated_at();

alter table public.blog_posts enable row level security;
alter table public.blog_post_blocks enable row level security;
alter table public.blog_admin_login_attempts enable row level security;

revoke all on public.blog_posts from public, anon, authenticated;
revoke all on public.blog_post_blocks from public, anon, authenticated;
revoke all on public.blog_admin_login_attempts from public, anon, authenticated;

grant select on public.blog_posts to anon, authenticated;
grant select on public.blog_post_blocks to anon, authenticated;

create policy blog_posts_public_read on public.blog_posts
  for select to anon, authenticated using (status = 'published');

create policy blog_post_blocks_public_read on public.blog_post_blocks
  for select to anon, authenticated using (
    exists (
      select 1 from public.blog_posts p
      where p.id = post_id and p.status = 'published'
    )
  );

-- A single project-admin RPC keeps block replacement atomic, including validation.
create or replace function public.admin_save_blog_post(
  p_id uuid,
  p_title text,
  p_cover_alt text,
  p_blocks jsonb,
  p_publish boolean
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  block jsonb;
  block_position integer := 0;
  clean_title text := btrim(coalesce(p_title, ''));
  clean_alt text := btrim(coalesce(p_cover_alt, ''));
begin
  if current_user <> 'project_admin' then
    raise exception 'admin only';
  end if;

  if char_length(clean_title) > 180 or char_length(clean_alt) > 240 then
    raise exception 'invalid post fields';
  end if;

  if jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) > 100 then
    raise exception 'invalid blocks';
  end if;

  if p_publish and (clean_title = '' or clean_alt = '' or jsonb_array_length(p_blocks) = 0) then
    raise exception 'publication incomplete';
  end if;

  if not exists (select 1 from public.blog_posts where id = p_id for update) then
    raise exception 'post not found';
  end if;

  for block in select value from jsonb_array_elements(p_blocks)
  loop
    if block->>'kind' not in ('heading2', 'heading3', 'paragraph', 'ordered_list', 'unordered_list', 'quote')
      or nullif(btrim(block->>'content'), '') is null
      or char_length(block->>'content') > 10000 then
      raise exception 'invalid block';
    end if;
  end loop;

  update public.blog_posts
    set title = clean_title,
        cover_alt = clean_alt,
        status = case when p_publish then 'published' else 'draft' end,
        published_at = case when p_publish then coalesce(published_at, now()) else published_at end
    where id = p_id;

  delete from public.blog_post_blocks where post_id = p_id;

  for block in select value from jsonb_array_elements(p_blocks)
  loop
    insert into public.blog_post_blocks (post_id, position, kind, content)
    values (p_id, block_position, block->>'kind', btrim(block->>'content'));
    block_position := block_position + 1;
  end loop;
end;
$$;

revoke all on function public.admin_save_blog_post(uuid, text, text, jsonb, boolean)
  from public, anon, authenticated;
