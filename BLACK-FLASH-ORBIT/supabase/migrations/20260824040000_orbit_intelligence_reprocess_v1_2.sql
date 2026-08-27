alter table public.orbit_intelligence_sources
  add column if not exists content_snapshot text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.orbit_intelligence_sources
  drop constraint if exists orbit_intelligence_sources_metadata_object;

alter table public.orbit_intelligence_sources
  add constraint orbit_intelligence_sources_metadata_object
    check (jsonb_typeof(metadata) = 'object');

create table if not exists public.orbit_intelligence_audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references public.orbit_intelligence_sources(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint orbit_intelligence_audit_events_type_check
    check (event_type in ('source_reprocessed')),
  constraint orbit_intelligence_audit_events_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint orbit_intelligence_audit_events_safe_metadata_check
    check (
      metadata::text !~* '(authorization|cookie|password|passwd|secret|token|api[_-]?key|service[_-]?role|access[_-]?key|refresh[_-]?token|prompt|payload|credential)'
    )
);

create index if not exists orbit_intelligence_audit_events_owner_created_idx
  on public.orbit_intelligence_audit_events (owner_id, created_at desc);

create index if not exists orbit_intelligence_audit_events_owner_source_idx
  on public.orbit_intelligence_audit_events (owner_id, source_id, created_at desc);

alter table public.orbit_intelligence_audit_events enable row level security;

drop policy if exists "Intelligence audit owners can read own events"
  on public.orbit_intelligence_audit_events;
drop policy if exists "Intelligence audit owners can insert own events"
  on public.orbit_intelligence_audit_events;
drop policy if exists "Intelligence audit owners can update own events"
  on public.orbit_intelligence_audit_events;
drop policy if exists "Intelligence audit owners can delete own events"
  on public.orbit_intelligence_audit_events;

create policy "Intelligence audit owners can read own events"
on public.orbit_intelligence_audit_events for select
using (owner_id = auth.uid());

create policy "Intelligence audit owners can insert own events"
on public.orbit_intelligence_audit_events for insert
with check (false);

create policy "Intelligence audit owners can update own events"
on public.orbit_intelligence_audit_events for update
using (false)
with check (false);

create policy "Intelligence audit owners can delete own events"
on public.orbit_intelligence_audit_events for delete
using (false);
