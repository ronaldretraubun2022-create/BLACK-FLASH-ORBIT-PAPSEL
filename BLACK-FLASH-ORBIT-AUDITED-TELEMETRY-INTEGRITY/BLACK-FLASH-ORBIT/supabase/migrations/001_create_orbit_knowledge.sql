create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.orbit_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  title text not null,
  content text not null,
  source text default 'manual',
  use_in_ai_context boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orbit_knowledge
  add column if not exists user_email text,
  add column if not exists title text,
  add column if not exists content text,
  add column if not exists source text default 'manual',
  add column if not exists use_in_ai_context boolean not null default true,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists orbit_knowledge_user_email_idx on public.orbit_knowledge (user_email);
create index if not exists orbit_knowledge_use_context_idx on public.orbit_knowledge (user_email, use_in_ai_context);
create index if not exists orbit_knowledge_title_trgm_idx on public.orbit_knowledge using gin (title gin_trgm_ops);
create index if not exists orbit_knowledge_source_trgm_idx on public.orbit_knowledge using gin (source gin_trgm_ops);
create index if not exists orbit_knowledge_content_trgm_idx on public.orbit_knowledge using gin (content gin_trgm_ops);

alter table public.orbit_knowledge enable row level security;

create policy "Users can read own orbit knowledge"
on public.orbit_knowledge for select
using (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Users can insert own orbit knowledge"
on public.orbit_knowledge for insert
with check (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Users can update own orbit knowledge"
on public.orbit_knowledge for update
using (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
with check (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Users can delete own orbit knowledge"
on public.orbit_knowledge for delete
using (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create or replace function public.set_orbit_knowledge_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orbit_knowledge_set_updated_at on public.orbit_knowledge;

create trigger orbit_knowledge_set_updated_at
before update on public.orbit_knowledge
for each row
execute function public.set_orbit_knowledge_updated_at();
