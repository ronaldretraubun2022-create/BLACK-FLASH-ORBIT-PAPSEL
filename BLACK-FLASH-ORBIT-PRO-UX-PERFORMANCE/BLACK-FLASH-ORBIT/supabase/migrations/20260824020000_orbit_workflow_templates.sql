create table if not exists public.orbit_workflow_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  definition_id text not null,
  trigger_label text,
  action_label text,
  schedule text not null default 'Manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orbit_workflow_templates_name_length_check
    check (char_length(name) between 1 and 120),
  constraint orbit_workflow_templates_definition_length_check
    check (char_length(definition_id) between 1 and 80),
  constraint orbit_workflow_templates_safe_metadata_check
    check (
      metadata::text !~* '(authorization|cookie|password|passwd|secret|token|api[_-]?key|service[_-]?role|access[_-]?key|refresh[_-]?token|prompt|payload|credential)'
    )
);

alter table public.orbit_workflow_runs
  add column if not exists template_id uuid references public.orbit_workflow_templates(id) on delete set null;

create unique index if not exists orbit_workflow_templates_owner_name_idx
  on public.orbit_workflow_templates (owner_id, lower(name));

create index if not exists orbit_workflow_templates_owner_updated_idx
  on public.orbit_workflow_templates (owner_id, updated_at desc);

create index if not exists orbit_workflow_runs_owner_template_idx
  on public.orbit_workflow_runs (owner_id, template_id, created_at desc)
  where template_id is not null;

alter table public.orbit_workflow_templates enable row level security;

drop policy if exists "Workflow template owners can read own templates"
  on public.orbit_workflow_templates;
drop policy if exists "Workflow template owners can insert own templates"
  on public.orbit_workflow_templates;
drop policy if exists "Workflow template owners can update own templates"
  on public.orbit_workflow_templates;
drop policy if exists "Workflow template owners can delete own templates"
  on public.orbit_workflow_templates;

create policy "Workflow template owners can read own templates"
on public.orbit_workflow_templates for select
using (owner_id = auth.uid());

create policy "Workflow template owners can insert own templates"
on public.orbit_workflow_templates for insert
with check (owner_id = auth.uid());

create policy "Workflow template owners can update own templates"
on public.orbit_workflow_templates for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Workflow template owners can delete own templates"
on public.orbit_workflow_templates for delete
using (owner_id = auth.uid());

create or replace function public.set_orbit_workflow_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orbit_workflow_templates_set_updated_at
  on public.orbit_workflow_templates;

create trigger orbit_workflow_templates_set_updated_at
before update on public.orbit_workflow_templates
for each row
execute function public.set_orbit_workflow_updated_at();
