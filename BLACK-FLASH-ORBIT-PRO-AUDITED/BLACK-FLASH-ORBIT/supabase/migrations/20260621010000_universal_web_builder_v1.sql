create extension if not exists pgcrypto;

create table if not exists public.orbit_web_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  title text not null,
  slug text not null,
  description text,
  status text not null default 'draft',
  theme jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_exported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orbit_web_projects_id_user_id_unique unique (id, user_id),
  constraint orbit_web_projects_title_length
    check (char_length(trim(title)) between 1 and 160),
  constraint orbit_web_projects_slug_format
    check (slug = lower(trim(slug)) and slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint orbit_web_projects_status_check
    check (status in ('draft', 'exported', 'archived')),
  constraint orbit_web_projects_theme_object
    check (jsonb_typeof(theme) = 'object'),
  constraint orbit_web_projects_settings_object
    check (jsonb_typeof(settings) = 'object'),
  constraint orbit_web_projects_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.orbit_web_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  path text not null default '/',
  sort_order integer not null default 0,
  seo jsonb not null default '{}'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orbit_web_pages_project_owner_fk
    foreign key (project_id, user_id)
    references public.orbit_web_projects (id, user_id)
    on delete cascade,
  constraint orbit_web_pages_title_length
    check (char_length(trim(title)) between 1 and 160),
  constraint orbit_web_pages_path_format
    check (
      path = '/'
      or (path = lower(trim(path)) and path ~ '^/[a-z0-9][a-z0-9/_-]*$')
    ),
  constraint orbit_web_pages_sort_order_nonnegative
    check (sort_order >= 0),
  constraint orbit_web_pages_seo_object
    check (jsonb_typeof(seo) = 'object'),
  constraint orbit_web_pages_sections_array
    check (jsonb_typeof(sections) = 'array'),
  constraint orbit_web_pages_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.orbit_web_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null default 'image',
  storage_path text,
  source_url text,
  alt_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orbit_web_assets_project_owner_fk
    foreign key (project_id, user_id)
    references public.orbit_web_projects (id, user_id)
    on delete cascade,
  constraint orbit_web_assets_type_check
    check (
      asset_type in (
        'image',
        'video',
        'audio',
        'font',
        'document',
        'external',
        'other'
      )
    ),
  constraint orbit_web_assets_source_check
    check (
      nullif(trim(coalesce(storage_path, '')), '') is not null
      or nullif(trim(coalesce(source_url, '')), '') is not null
    ),
  constraint orbit_web_assets_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists orbit_web_projects_user_slug_idx
  on public.orbit_web_projects (user_id, slug);

create index if not exists orbit_web_projects_user_updated_idx
  on public.orbit_web_projects (user_id, updated_at desc);

create index if not exists orbit_web_projects_status_updated_idx
  on public.orbit_web_projects (status, updated_at desc);

create unique index if not exists orbit_web_pages_project_path_idx
  on public.orbit_web_pages (project_id, path);

create index if not exists orbit_web_pages_project_sort_idx
  on public.orbit_web_pages (project_id, sort_order, updated_at desc);

create index if not exists orbit_web_pages_user_updated_idx
  on public.orbit_web_pages (user_id, updated_at desc);

create index if not exists orbit_web_assets_project_type_idx
  on public.orbit_web_assets (project_id, asset_type);

create index if not exists orbit_web_assets_user_updated_idx
  on public.orbit_web_assets (user_id, updated_at desc);

create index if not exists orbit_web_assets_storage_path_idx
  on public.orbit_web_assets (storage_path)
  where storage_path is not null;

create or replace function public.set_orbit_web_builder_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orbit_web_projects_set_updated_at
  on public.orbit_web_projects;

create trigger orbit_web_projects_set_updated_at
before update on public.orbit_web_projects
for each row
execute function public.set_orbit_web_builder_updated_at();

drop trigger if exists orbit_web_pages_set_updated_at
  on public.orbit_web_pages;

create trigger orbit_web_pages_set_updated_at
before update on public.orbit_web_pages
for each row
execute function public.set_orbit_web_builder_updated_at();

drop trigger if exists orbit_web_assets_set_updated_at
  on public.orbit_web_assets;

create trigger orbit_web_assets_set_updated_at
before update on public.orbit_web_assets
for each row
execute function public.set_orbit_web_builder_updated_at();

alter table public.orbit_web_projects enable row level security;
alter table public.orbit_web_pages enable row level security;
alter table public.orbit_web_assets enable row level security;

revoke all on table public.orbit_web_projects from anon;
revoke all on table public.orbit_web_pages from anon;
revoke all on table public.orbit_web_assets from anon;

grant select, insert, update, delete on table public.orbit_web_projects
  to authenticated;

grant select, insert, update, delete on table public.orbit_web_pages
  to authenticated;

grant select, insert, update, delete on table public.orbit_web_assets
  to authenticated;

drop policy if exists orbit_web_projects_select_own
  on public.orbit_web_projects;
drop policy if exists orbit_web_projects_insert_own
  on public.orbit_web_projects;
drop policy if exists orbit_web_projects_update_own
  on public.orbit_web_projects;
drop policy if exists orbit_web_projects_delete_own
  on public.orbit_web_projects;

create policy orbit_web_projects_select_own
  on public.orbit_web_projects
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy orbit_web_projects_insert_own
  on public.orbit_web_projects
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy orbit_web_projects_update_own
  on public.orbit_web_projects
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy orbit_web_projects_delete_own
  on public.orbit_web_projects
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists orbit_web_pages_select_own
  on public.orbit_web_pages;
drop policy if exists orbit_web_pages_insert_own
  on public.orbit_web_pages;
drop policy if exists orbit_web_pages_update_own
  on public.orbit_web_pages;
drop policy if exists orbit_web_pages_delete_own
  on public.orbit_web_pages;

create policy orbit_web_pages_select_own
  on public.orbit_web_pages
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy orbit_web_pages_insert_own
  on public.orbit_web_pages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy orbit_web_pages_update_own
  on public.orbit_web_pages
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy orbit_web_pages_delete_own
  on public.orbit_web_pages
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists orbit_web_assets_select_own
  on public.orbit_web_assets;
drop policy if exists orbit_web_assets_insert_own
  on public.orbit_web_assets;
drop policy if exists orbit_web_assets_update_own
  on public.orbit_web_assets;
drop policy if exists orbit_web_assets_delete_own
  on public.orbit_web_assets;

create policy orbit_web_assets_select_own
  on public.orbit_web_assets
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy orbit_web_assets_insert_own
  on public.orbit_web_assets
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy orbit_web_assets_update_own
  on public.orbit_web_assets
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy orbit_web_assets_delete_own
  on public.orbit_web_assets
  for delete
  to authenticated
  using (auth.uid() = user_id);
