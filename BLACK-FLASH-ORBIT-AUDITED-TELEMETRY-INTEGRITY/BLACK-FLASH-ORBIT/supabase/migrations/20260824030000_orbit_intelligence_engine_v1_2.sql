create extension if not exists pgcrypto;

create table if not exists public.orbit_intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  title text not null,
  content_hash text not null,
  source_url text,
  duplicate_of_source_id uuid references public.orbit_intelligence_sources(id) on delete set null,
  status text not null default 'processed',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orbit_intelligence_sources_type_check
    check (source_type in (
      'knowledge_document',
      'newsroom_generation',
      'workflow_run',
      'automation_record',
      'manual_note'
    )),
  constraint orbit_intelligence_sources_status_check
    check (status in ('queued', 'processing', 'processed', 'duplicate', 'failed')),
  constraint orbit_intelligence_sources_url_check
    check (
      source_url is null
      or source_url ~* '^https?://'
    )
);

create unique index if not exists orbit_intelligence_sources_owner_source_idx
  on public.orbit_intelligence_sources (owner_id, source_type, source_id);

create index if not exists orbit_intelligence_sources_owner_hash_idx
  on public.orbit_intelligence_sources (owner_id, content_hash);

create index if not exists orbit_intelligence_sources_owner_created_idx
  on public.orbit_intelligence_sources (owner_id, created_at desc);

create table if not exists public.orbit_intelligence_entities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  canonical_name text not null,
  normalized_name text not null,
  confidence numeric(5,4) not null default 0.5000,
  mention_count integer not null default 1,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orbit_intelligence_entities_type_check
    check (entity_type in (
      'person',
      'organization',
      'location',
      'project',
      'product',
      'event'
    )),
  constraint orbit_intelligence_entities_confidence_check
    check (confidence >= 0 and confidence <= 1)
);

create unique index if not exists orbit_intelligence_entities_owner_name_idx
  on public.orbit_intelligence_entities (owner_id, entity_type, normalized_name);

create index if not exists orbit_intelligence_entities_owner_seen_idx
  on public.orbit_intelligence_entities (owner_id, last_seen_at desc);

create table if not exists public.orbit_intelligence_claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.orbit_intelligence_sources(id) on delete cascade,
  claim_text text not null,
  normalized_claim text not null,
  conflict_key text not null,
  claim_status text not null default 'unverified',
  confidence numeric(5,4) not null default 0.5000,
  polarity text not null default 'positive',
  observed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orbit_intelligence_claims_status_check
    check (claim_status in (
      'confirmed',
      'supported',
      'conflicting',
      'unverified',
      'inferred'
    )),
  constraint orbit_intelligence_claims_polarity_check
    check (polarity in ('positive', 'negative')),
  constraint orbit_intelligence_claims_confidence_check
    check (confidence >= 0 and confidence <= 1)
);

create unique index if not exists orbit_intelligence_claims_owner_source_claim_idx
  on public.orbit_intelligence_claims (owner_id, source_id, normalized_claim);

create index if not exists orbit_intelligence_claims_owner_status_idx
  on public.orbit_intelligence_claims (owner_id, claim_status, observed_at desc);

create index if not exists orbit_intelligence_claims_owner_conflict_idx
  on public.orbit_intelligence_claims (owner_id, conflict_key, polarity);

create table if not exists public.orbit_intelligence_relationships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.orbit_intelligence_sources(id) on delete cascade,
  subject_entity_id uuid not null references public.orbit_intelligence_entities(id) on delete cascade,
  object_entity_id uuid not null references public.orbit_intelligence_entities(id) on delete cascade,
  relationship_type text not null,
  status text not null default 'supported',
  confidence numeric(5,4) not null default 0.5000,
  evidence_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orbit_intelligence_relationships_status_check
    check (status in ('supported', 'inferred')),
  constraint orbit_intelligence_relationships_confidence_check
    check (confidence >= 0 and confidence <= 1),
  constraint orbit_intelligence_relationships_no_self_link
    check (subject_entity_id <> object_entity_id)
);

create unique index if not exists orbit_intelligence_relationships_owner_edge_idx
  on public.orbit_intelligence_relationships (
    owner_id,
    source_id,
    subject_entity_id,
    relationship_type,
    object_entity_id
  );

create index if not exists orbit_intelligence_relationships_owner_source_idx
  on public.orbit_intelligence_relationships (owner_id, source_id);

create table if not exists public.orbit_intelligence_source_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.orbit_intelligence_sources(id) on delete cascade,
  entity_id uuid references public.orbit_intelligence_entities(id) on delete cascade,
  claim_id uuid references public.orbit_intelligence_claims(id) on delete cascade,
  relationship_id uuid references public.orbit_intelligence_relationships(id) on delete cascade,
  link_type text not null,
  target_key text not null,
  evidence_text text not null,
  confidence numeric(5,4) not null default 0.5000,
  created_at timestamptz not null default now(),

  constraint orbit_intelligence_source_links_one_target_check
    check (
      num_nonnulls(entity_id, claim_id, relationship_id) = 1
    ),
  constraint orbit_intelligence_source_links_confidence_check
    check (confidence >= 0 and confidence <= 1)
);

create unique index if not exists orbit_intelligence_source_links_owner_target_idx
  on public.orbit_intelligence_source_links (
    owner_id,
    source_id,
    link_type,
    target_key
  );

create index if not exists orbit_intelligence_source_links_owner_source_idx
  on public.orbit_intelligence_source_links (owner_id, source_id, created_at desc);

alter table public.orbit_intelligence_sources enable row level security;
alter table public.orbit_intelligence_entities enable row level security;
alter table public.orbit_intelligence_claims enable row level security;
alter table public.orbit_intelligence_relationships enable row level security;
alter table public.orbit_intelligence_source_links enable row level security;

drop policy if exists "Intelligence source owners can read own sources"
  on public.orbit_intelligence_sources;
drop policy if exists "Intelligence source owners can insert own sources"
  on public.orbit_intelligence_sources;
drop policy if exists "Intelligence source owners can update own sources"
  on public.orbit_intelligence_sources;
drop policy if exists "Intelligence source owners can delete own sources"
  on public.orbit_intelligence_sources;

create policy "Intelligence source owners can read own sources"
on public.orbit_intelligence_sources for select
using (owner_id = auth.uid());

create policy "Intelligence source owners can insert own sources"
on public.orbit_intelligence_sources for insert
with check (owner_id = auth.uid());

create policy "Intelligence source owners can update own sources"
on public.orbit_intelligence_sources for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Intelligence source owners can delete own sources"
on public.orbit_intelligence_sources for delete
using (false);

drop policy if exists "Intelligence entity owners can read own entities"
  on public.orbit_intelligence_entities;
drop policy if exists "Intelligence entity owners can insert own entities"
  on public.orbit_intelligence_entities;
drop policy if exists "Intelligence entity owners can update own entities"
  on public.orbit_intelligence_entities;
drop policy if exists "Intelligence entity owners can delete own entities"
  on public.orbit_intelligence_entities;

create policy "Intelligence entity owners can read own entities"
on public.orbit_intelligence_entities for select
using (owner_id = auth.uid());

create policy "Intelligence entity owners can insert own entities"
on public.orbit_intelligence_entities for insert
with check (owner_id = auth.uid());

create policy "Intelligence entity owners can update own entities"
on public.orbit_intelligence_entities for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Intelligence entity owners can delete own entities"
on public.orbit_intelligence_entities for delete
using (false);

drop policy if exists "Intelligence claim owners can read own claims"
  on public.orbit_intelligence_claims;
drop policy if exists "Intelligence claim owners can insert own claims"
  on public.orbit_intelligence_claims;
drop policy if exists "Intelligence claim owners can update own claims"
  on public.orbit_intelligence_claims;
drop policy if exists "Intelligence claim owners can delete own claims"
  on public.orbit_intelligence_claims;

create policy "Intelligence claim owners can read own claims"
on public.orbit_intelligence_claims for select
using (owner_id = auth.uid());

create policy "Intelligence claim owners can insert own claims"
on public.orbit_intelligence_claims for insert
with check (owner_id = auth.uid());

create policy "Intelligence claim owners can update own claims"
on public.orbit_intelligence_claims for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Intelligence claim owners can delete own claims"
on public.orbit_intelligence_claims for delete
using (false);

drop policy if exists "Intelligence relationship owners can read own relationships"
  on public.orbit_intelligence_relationships;
drop policy if exists "Intelligence relationship owners can insert own relationships"
  on public.orbit_intelligence_relationships;
drop policy if exists "Intelligence relationship owners can update own relationships"
  on public.orbit_intelligence_relationships;
drop policy if exists "Intelligence relationship owners can delete own relationships"
  on public.orbit_intelligence_relationships;

create policy "Intelligence relationship owners can read own relationships"
on public.orbit_intelligence_relationships for select
using (owner_id = auth.uid());

create policy "Intelligence relationship owners can insert own relationships"
on public.orbit_intelligence_relationships for insert
with check (owner_id = auth.uid());

create policy "Intelligence relationship owners can update own relationships"
on public.orbit_intelligence_relationships for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Intelligence relationship owners can delete own relationships"
on public.orbit_intelligence_relationships for delete
using (false);

drop policy if exists "Intelligence source link owners can read own source links"
  on public.orbit_intelligence_source_links;
drop policy if exists "Intelligence source link owners can insert own source links"
  on public.orbit_intelligence_source_links;
drop policy if exists "Intelligence source link owners can update own source links"
  on public.orbit_intelligence_source_links;
drop policy if exists "Intelligence source link owners can delete own source links"
  on public.orbit_intelligence_source_links;

create policy "Intelligence source link owners can read own source links"
on public.orbit_intelligence_source_links for select
using (owner_id = auth.uid());

create policy "Intelligence source link owners can insert own source links"
on public.orbit_intelligence_source_links for insert
with check (owner_id = auth.uid());

create policy "Intelligence source link owners can update own source links"
on public.orbit_intelligence_source_links for update
using (false)
with check (false);

create policy "Intelligence source link owners can delete own source links"
on public.orbit_intelligence_source_links for delete
using (false);

create or replace function public.set_orbit_intelligence_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orbit_intelligence_sources_set_updated_at
  on public.orbit_intelligence_sources;
create trigger orbit_intelligence_sources_set_updated_at
before update on public.orbit_intelligence_sources
for each row
execute function public.set_orbit_intelligence_updated_at();

drop trigger if exists orbit_intelligence_entities_set_updated_at
  on public.orbit_intelligence_entities;
create trigger orbit_intelligence_entities_set_updated_at
before update on public.orbit_intelligence_entities
for each row
execute function public.set_orbit_intelligence_updated_at();

drop trigger if exists orbit_intelligence_claims_set_updated_at
  on public.orbit_intelligence_claims;
create trigger orbit_intelligence_claims_set_updated_at
before update on public.orbit_intelligence_claims
for each row
execute function public.set_orbit_intelligence_updated_at();

drop trigger if exists orbit_intelligence_relationships_set_updated_at
  on public.orbit_intelligence_relationships;
create trigger orbit_intelligence_relationships_set_updated_at
before update on public.orbit_intelligence_relationships
for each row
execute function public.set_orbit_intelligence_updated_at();
