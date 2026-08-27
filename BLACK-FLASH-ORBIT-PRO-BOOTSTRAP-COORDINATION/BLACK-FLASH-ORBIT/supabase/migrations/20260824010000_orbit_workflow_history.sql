create extension if not exists pgcrypto;

create table if not exists public.orbit_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  definition_id text not null,
  status text not null default 'queued',
  metadata jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orbit_workflow_runs_status_check
    check (status in (
      'queued',
      'running',
      'waiting_approval',
      'succeeded',
      'failed',
      'cancelled',
      'timed_out'
    ))
);

create table if not exists public.orbit_workflow_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.orbit_workflow_runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  step_id text not null,
  status text not null default 'queued',
  tool text not null,
  attempts integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orbit_workflow_run_steps_status_check
    check (status in (
      'queued',
      'running',
      'waiting_approval',
      'succeeded',
      'failed',
      'skipped',
      'timed_out'
    )),
  constraint orbit_workflow_run_steps_unique_step
    unique (run_id, step_id)
);

create table if not exists public.orbit_workflow_approvals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.orbit_workflow_runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  step_id text not null,
  status text not null default 'approved',
  approved_by uuid not null references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint orbit_workflow_approvals_status_check
    check (status in ('approved', 'rejected')),
  constraint orbit_workflow_approvals_unique_step
    unique (run_id, step_id)
);

create table if not exists public.orbit_workflow_audit_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.orbit_workflow_runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orbit_workflow_runs_owner_created_idx
  on public.orbit_workflow_runs (owner_id, created_at desc);

create index if not exists orbit_workflow_runs_owner_status_idx
  on public.orbit_workflow_runs (owner_id, status, created_at desc);

create index if not exists orbit_workflow_run_steps_owner_run_idx
  on public.orbit_workflow_run_steps (owner_id, run_id, created_at asc);

create index if not exists orbit_workflow_approvals_owner_run_idx
  on public.orbit_workflow_approvals (owner_id, run_id, created_at asc);

create index if not exists orbit_workflow_audit_events_owner_run_idx
  on public.orbit_workflow_audit_events (owner_id, run_id, created_at desc);

alter table public.orbit_workflow_runs enable row level security;
alter table public.orbit_workflow_run_steps enable row level security;
alter table public.orbit_workflow_approvals enable row level security;
alter table public.orbit_workflow_audit_events enable row level security;

drop policy if exists "Workflow run owners can read own runs"
  on public.orbit_workflow_runs;
drop policy if exists "Workflow run owners can insert own runs"
  on public.orbit_workflow_runs;
drop policy if exists "Workflow run owners can update own runs"
  on public.orbit_workflow_runs;
drop policy if exists "Workflow run owners can delete own runs"
  on public.orbit_workflow_runs;

create policy "Workflow run owners can read own runs"
on public.orbit_workflow_runs for select
using (owner_id = auth.uid());

create policy "Workflow run owners can insert own runs"
on public.orbit_workflow_runs for insert
with check (owner_id = auth.uid());

create policy "Workflow run owners can update own runs"
on public.orbit_workflow_runs for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Workflow run owners can delete own runs"
on public.orbit_workflow_runs for delete
using (false);

drop policy if exists "Workflow step owners can read own steps"
  on public.orbit_workflow_run_steps;
drop policy if exists "Workflow step owners can insert own steps"
  on public.orbit_workflow_run_steps;
drop policy if exists "Workflow step owners can update own steps"
  on public.orbit_workflow_run_steps;
drop policy if exists "Workflow step owners can delete own steps"
  on public.orbit_workflow_run_steps;

create policy "Workflow step owners can read own steps"
on public.orbit_workflow_run_steps for select
using (owner_id = auth.uid());

create policy "Workflow step owners can insert own steps"
on public.orbit_workflow_run_steps for insert
with check (owner_id = auth.uid());

create policy "Workflow step owners can update own steps"
on public.orbit_workflow_run_steps for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Workflow step owners can delete own steps"
on public.orbit_workflow_run_steps for delete
using (false);

drop policy if exists "Workflow approval owners can read own approvals"
  on public.orbit_workflow_approvals;
drop policy if exists "Workflow approval owners can insert own approvals"
  on public.orbit_workflow_approvals;
drop policy if exists "Workflow approval owners can update own approvals"
  on public.orbit_workflow_approvals;
drop policy if exists "Workflow approval owners can delete own approvals"
  on public.orbit_workflow_approvals;

create policy "Workflow approval owners can read own approvals"
on public.orbit_workflow_approvals for select
using (owner_id = auth.uid() and approved_by = auth.uid());

create policy "Workflow approval owners can insert own approvals"
on public.orbit_workflow_approvals for insert
with check (owner_id = auth.uid() and approved_by = auth.uid());

create policy "Workflow approval owners can update own approvals"
on public.orbit_workflow_approvals for update
using (false)
with check (false);

create policy "Workflow approval owners can delete own approvals"
on public.orbit_workflow_approvals for delete
using (false);

drop policy if exists "Workflow audit owners can read own events"
  on public.orbit_workflow_audit_events;
drop policy if exists "Workflow audit owners can insert own events"
  on public.orbit_workflow_audit_events;
drop policy if exists "Workflow audit owners can update own events"
  on public.orbit_workflow_audit_events;
drop policy if exists "Workflow audit owners can delete own events"
  on public.orbit_workflow_audit_events;

create policy "Workflow audit owners can read own events"
on public.orbit_workflow_audit_events for select
using (owner_id = auth.uid());

create policy "Workflow audit owners can insert own events"
on public.orbit_workflow_audit_events for insert
with check (owner_id = auth.uid());

create policy "Workflow audit owners can update own events"
on public.orbit_workflow_audit_events for update
using (false)
with check (false);

create policy "Workflow audit owners can delete own events"
on public.orbit_workflow_audit_events for delete
using (false);

create or replace function public.set_orbit_workflow_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orbit_workflow_runs_set_updated_at
  on public.orbit_workflow_runs;

create trigger orbit_workflow_runs_set_updated_at
before update on public.orbit_workflow_runs
for each row
execute function public.set_orbit_workflow_updated_at();

drop trigger if exists orbit_workflow_run_steps_set_updated_at
  on public.orbit_workflow_run_steps;

create trigger orbit_workflow_run_steps_set_updated_at
before update on public.orbit_workflow_run_steps
for each row
execute function public.set_orbit_workflow_updated_at();
