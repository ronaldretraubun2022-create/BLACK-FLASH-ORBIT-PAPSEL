create table if not exists public.orbit_agent_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orbit_agent_jobs_status_check
    check (status in (
      'queued',
      'diagnosing',
      'diagnosed',
      'running',
      'validating',
      'awaiting_approval',
      'approved',
      'rejected',
      'succeeded',
      'failed'
    )),
  constraint orbit_agent_jobs_title_safe_check
    check (
      title !~* '(authorization|cookie|password|passwd|secret|token|api[_-]?key|service[_-]?role|access[_-]?key|refresh[_-]?token|credential)'
    )
);

create table if not exists public.orbit_agent_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.orbit_agent_jobs(id) on delete cascade,
  stage text not null,
  status text not null default 'running',
  exit_code integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  safe_summary text not null default '',
  changed_files jsonb not null default '[]'::jsonb,

  constraint orbit_agent_runs_stage_check
    check (stage in ('diagnose', 'codex_repair', 'validate', 'approval', 'reject', 'diff')),
  constraint orbit_agent_runs_status_check
    check (status in ('queued', 'running', 'succeeded', 'failed', 'blocked')),
  constraint orbit_agent_runs_changed_files_array_check
    check (jsonb_typeof(changed_files) = 'array'),
  constraint orbit_agent_runs_safe_summary_check
    check (
      safe_summary !~* '(authorization|cookie|password|passwd|secret|token|api[_-]?key|service[_-]?role|access[_-]?key|refresh[_-]?token|credential)'
    )
);

create table if not exists public.orbit_agent_audit (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.orbit_agent_jobs(id) on delete cascade,
  event_type text not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint orbit_agent_audit_metadata_object_check
    check (jsonb_typeof(safe_metadata) = 'object'),
  constraint orbit_agent_audit_safe_metadata_check
    check (
      safe_metadata::text !~* '(authorization|cookie|password|passwd|secret|token|api[_-]?key|service[_-]?role|access[_-]?key|refresh[_-]?token|credential|prompt|env)'
    )
);

create index if not exists orbit_agent_jobs_owner_created_idx
  on public.orbit_agent_jobs (owner_id, created_at desc);

create index if not exists orbit_agent_jobs_owner_status_idx
  on public.orbit_agent_jobs (owner_id, status, updated_at desc);

create index if not exists orbit_agent_runs_owner_job_idx
  on public.orbit_agent_runs (owner_id, job_id, started_at desc);

create index if not exists orbit_agent_runs_owner_stage_idx
  on public.orbit_agent_runs (owner_id, stage, started_at desc);

create index if not exists orbit_agent_audit_owner_job_idx
  on public.orbit_agent_audit (owner_id, job_id, created_at desc);

alter table public.orbit_agent_jobs enable row level security;
alter table public.orbit_agent_runs enable row level security;
alter table public.orbit_agent_audit enable row level security;

drop policy if exists "Agent job owners can read own jobs"
  on public.orbit_agent_jobs;
drop policy if exists "Agent job owners can insert own jobs"
  on public.orbit_agent_jobs;
drop policy if exists "Agent job owners can update own jobs"
  on public.orbit_agent_jobs;
drop policy if exists "Agent job owners can delete own jobs"
  on public.orbit_agent_jobs;

create policy "Agent job owners can read own jobs"
on public.orbit_agent_jobs for select
using (owner_id = auth.uid());

create policy "Agent job owners can insert own jobs"
on public.orbit_agent_jobs for insert
with check (owner_id = auth.uid());

create policy "Agent job owners can update own jobs"
on public.orbit_agent_jobs for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Agent job owners can delete own jobs"
on public.orbit_agent_jobs for delete
using (false);

drop policy if exists "Agent run owners can read own runs"
  on public.orbit_agent_runs;
drop policy if exists "Agent run owners can insert own runs"
  on public.orbit_agent_runs;
drop policy if exists "Agent run owners can update own runs"
  on public.orbit_agent_runs;
drop policy if exists "Agent run owners can delete own runs"
  on public.orbit_agent_runs;

create policy "Agent run owners can read own runs"
on public.orbit_agent_runs for select
using (owner_id = auth.uid());

create policy "Agent run owners can insert own runs"
on public.orbit_agent_runs for insert
with check (owner_id = auth.uid());

create policy "Agent run owners can update own runs"
on public.orbit_agent_runs for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Agent run owners can delete own runs"
on public.orbit_agent_runs for delete
using (false);

drop policy if exists "Agent audit owners can read own events"
  on public.orbit_agent_audit;
drop policy if exists "Agent audit owners can insert own events"
  on public.orbit_agent_audit;
drop policy if exists "Agent audit owners can update own events"
  on public.orbit_agent_audit;
drop policy if exists "Agent audit owners can delete own events"
  on public.orbit_agent_audit;

create policy "Agent audit owners can read own events"
on public.orbit_agent_audit for select
using (owner_id = auth.uid());

create policy "Agent audit owners can insert own events"
on public.orbit_agent_audit for insert
with check (false);

create policy "Agent audit owners can update own events"
on public.orbit_agent_audit for update
using (false)
with check (false);

create policy "Agent audit owners can delete own events"
on public.orbit_agent_audit for delete
using (false);

create or replace function public.set_orbit_agent_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orbit_agent_jobs_set_updated_at
  on public.orbit_agent_jobs;
create trigger orbit_agent_jobs_set_updated_at
before update on public.orbit_agent_jobs
for each row
execute function public.set_orbit_agent_updated_at();
