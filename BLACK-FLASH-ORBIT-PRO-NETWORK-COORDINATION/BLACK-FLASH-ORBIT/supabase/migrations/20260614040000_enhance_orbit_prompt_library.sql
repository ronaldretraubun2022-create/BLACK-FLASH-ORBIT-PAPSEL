create extension if not exists pgcrypto;

create table if not exists public.orbit_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  category text not null default 'newsroom',
  content text not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orbit_prompts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.orbit_prompts
  add column if not exists user_email text;

alter table public.orbit_prompts
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.orbit_prompts
  add column if not exists category text not null default 'newsroom';

alter table public.orbit_prompts
  add column if not exists is_favorite boolean not null default false;

alter table public.orbit_prompts
  add column if not exists created_at timestamptz not null default now();

alter table public.orbit_prompts
  add column if not exists updated_at timestamptz not null default now();

update public.orbit_prompts prompt
set user_email = users.email
from auth.users users
where prompt.user_email is null
  and prompt.user_id = users.id;

update public.orbit_prompts
set created_by = coalesce(created_by, user_id)
where created_by is null
  and user_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orbit_prompts_title_length'
  ) then
    alter table public.orbit_prompts
      add constraint orbit_prompts_title_length
      check (char_length(trim(title)) between 1 and 140);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orbit_prompts_content_length'
  ) then
    alter table public.orbit_prompts
      add constraint orbit_prompts_content_length
      check (char_length(trim(content)) between 1 and 12000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orbit_prompts_category_slug'
  ) then
    alter table public.orbit_prompts
      add constraint orbit_prompts_category_slug
      check (category = lower(trim(category)) and category ~ '^[a-z0-9-]+$');
  end if;
end $$;

create index if not exists orbit_prompts_user_id_idx
  on public.orbit_prompts (user_id);

create index if not exists orbit_prompts_created_by_idx
  on public.orbit_prompts (created_by);

create index if not exists orbit_prompts_user_email_idx
  on public.orbit_prompts (lower(user_email));

create index if not exists orbit_prompts_user_category_idx
  on public.orbit_prompts (user_id, category, is_favorite desc, updated_at desc);

create index if not exists orbit_prompts_user_email_category_idx
  on public.orbit_prompts (lower(user_email), category, is_favorite desc, updated_at desc);

create index if not exists orbit_prompts_search_idx
  on public.orbit_prompts
  using gin (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(category, '')
    )
  );

create or replace function public.set_orbit_prompts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orbit_prompts_set_updated_at on public.orbit_prompts;

create trigger orbit_prompts_set_updated_at
before update on public.orbit_prompts
for each row
execute function public.set_orbit_prompts_updated_at();

alter table public.orbit_prompt_categories
  add column if not exists color text not null default '#64748b';

alter table public.orbit_prompt_categories
  add column if not exists icon text not null default 'tag';

insert into public.orbit_prompt_categories (slug, label, color, icon, sort_order)
values
  ('newsroom', 'Newsroom', '#d6a93a', 'newspaper', 10),
  ('osint', 'OSINT', '#7dd3fc', 'radar', 20),
  ('engineering', 'Engineering', '#94a3b8', 'code', 30),
  ('security', 'Security', '#991b1b', 'shield', 40),
  ('product', 'Product', '#a78bfa', 'box', 50),
  ('audit', 'Audit', '#fb7185', 'scan', 60),
  ('codex', 'Codex', '#22d3ee', 'terminal', 70),
  ('backend', 'Backend', '#38bdf8', 'server', 80),
  ('frontend', 'Frontend', '#f472b6', 'layout', 90),
  ('database', 'Database', '#2dd4bf', 'database', 100),
  ('supabase', 'Supabase', '#34d399', 'bolt', 110),
  ('automation', 'Automation', '#f59e0b', 'workflow', 120),
  ('monitoring', 'Monitoring', '#60a5fa', 'activity', 130),
  ('reports', 'Reports', '#c084fc', 'file', 140),
  ('ai', 'AI', '#06b6d4', 'sparkles', 150),
  ('devops', 'DevOps', '#f97316', 'rocket', 160)
on conflict (slug) do update
set
  label = excluded.label,
  color = excluded.color,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.orbit_prompts enable row level security;

drop policy if exists orbit_prompts_select_own on public.orbit_prompts;
drop policy if exists orbit_prompts_insert_own on public.orbit_prompts;
drop policy if exists orbit_prompts_update_own on public.orbit_prompts;
drop policy if exists orbit_prompts_delete_own on public.orbit_prompts;

create policy orbit_prompts_select_own
  on public.orbit_prompts
  for select
  using (
    auth.uid() = user_id
    or auth.uid() = created_by
    or lower(auth.jwt() ->> 'email') = lower(user_email)
  );

create policy orbit_prompts_insert_own
  on public.orbit_prompts
  for insert
  with check (
    auth.uid() = user_id
    and auth.uid() = created_by
    and lower(auth.jwt() ->> 'email') = lower(user_email)
  );

create policy orbit_prompts_update_own
  on public.orbit_prompts
  for update
  using (
    auth.uid() = user_id
    or auth.uid() = created_by
    or lower(auth.jwt() ->> 'email') = lower(user_email)
  )
  with check (
    auth.uid() = user_id
    and auth.uid() = created_by
    and lower(auth.jwt() ->> 'email') = lower(user_email)
  );

create policy orbit_prompts_delete_own
  on public.orbit_prompts
  for delete
  using (
    auth.uid() = user_id
    or auth.uid() = created_by
    or lower(auth.jwt() ->> 'email') = lower(user_email)
  );
