create table if not exists public.orbit_prompt_categories (
  slug text primary key,
  label text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orbit_prompt_categories_slug_format check (slug = lower(trim(slug)) and slug <> '')
);

insert into public.orbit_prompt_categories (slug, label, sort_order)
values
  ('newsroom', 'newsroom', 10),
  ('osint', 'osint', 20),
  ('engineering', 'engineering', 30),
  ('security', 'security', 40),
  ('product', 'product', 50),
  ('audit', 'audit', 60),
  ('codex', 'codex', 70),
  ('backend', 'backend', 80),
  ('frontend', 'frontend', 90),
  ('database', 'database', 100),
  ('supabase', 'supabase', 110),
  ('automation', 'automation', 120),
  ('monitoring', 'monitoring', 130),
  ('reports', 'reports', 140),
  ('ai', 'ai', 150),
  ('devops', 'devops', 160)
on conflict (slug) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.orbit_prompt_categories enable row level security;

drop policy if exists orbit_prompt_categories_read_all on public.orbit_prompt_categories;

create policy orbit_prompt_categories_read_all
  on public.orbit_prompt_categories
  for select
  using (true);
