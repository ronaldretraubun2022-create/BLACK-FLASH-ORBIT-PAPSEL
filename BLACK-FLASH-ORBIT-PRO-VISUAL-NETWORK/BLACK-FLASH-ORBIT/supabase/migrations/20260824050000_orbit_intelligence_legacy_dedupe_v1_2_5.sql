alter table public.orbit_intelligence_audit_events
  drop constraint if exists orbit_intelligence_audit_events_type_check;

alter table public.orbit_intelligence_audit_events
  add constraint orbit_intelligence_audit_events_type_check
    check (event_type in ('source_reprocessed', 'source_deduplicated'));

create index if not exists orbit_intelligence_sources_owner_type_hash_idx
  on public.orbit_intelligence_sources (owner_id, source_type, content_hash);
