create extension if not exists pgcrypto;

create table if not exists public.newsroom_generations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idempotency_key text,

  topic text not null,
  source_input_summary text,

  audience text,
  mode text,
  complexity text,
  channel text,

  draft text not null,
  verification jsonb not null default '{}'::jsonb,
  intelligence_summary jsonb not null default '{}'::jsonb,
  editorial_review_report jsonb not null default '{}'::jsonb,

  provider text,
  model text,
  prompt_version text,

  review_status text not null default 'NEEDS_REVIEW',
  publication_readiness text not null default 'NEEDS_REVIEW',

  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,

  editor_notes text,

  constraint newsroom_generations_review_status_check
    check (review_status in (
      'DRAFT',
      'AI_REVIEWED',
      'NEEDS_REVIEW',
      'READY_FOR_EDITOR',
      'APPROVED',
      'REJECTED'
    )),
  constraint newsroom_generations_idempotency_key_length_check
    check (idempotency_key is null or char_length(idempotency_key) <= 160)
);

create unique index if not exists newsroom_generations_owner_idempotency_idx
  on public.newsroom_generations (owner_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists newsroom_generations_owner_created_idx
  on public.newsroom_generations (owner_id, created_at desc);

create index if not exists newsroom_generations_owner_status_idx
  on public.newsroom_generations (owner_id, review_status, created_at desc);

create index if not exists newsroom_generations_owner_mode_idx
  on public.newsroom_generations (owner_id, mode, created_at desc);

create table if not exists public.newsroom_editorial_decisions (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.newsroom_generations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  decision text not null,
  previous_status text,
  next_status text not null,
  notes text,
  override_blockers boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now(),

  constraint newsroom_editorial_decisions_decision_check
    check (decision in ('APPROVE', 'REJECT', 'RETURN_TO_REVIEW', 'STATUS_CHANGE')),
  constraint newsroom_editorial_decisions_next_status_check
    check (next_status in (
      'DRAFT',
      'AI_REVIEWED',
      'NEEDS_REVIEW',
      'READY_FOR_EDITOR',
      'APPROVED',
      'REJECTED'
    ))
);

create index if not exists newsroom_editorial_decisions_generation_created_idx
  on public.newsroom_editorial_decisions (generation_id, created_at desc);

create index if not exists newsroom_editorial_decisions_owner_created_idx
  on public.newsroom_editorial_decisions (owner_id, created_at desc);

alter table public.newsroom_generations enable row level security;
alter table public.newsroom_editorial_decisions enable row level security;

drop policy if exists "Newsroom generation owners can read own generations"
  on public.newsroom_generations;
drop policy if exists "Newsroom generation owners can insert own generations"
  on public.newsroom_generations;
drop policy if exists "Newsroom generation owners can update own generations"
  on public.newsroom_generations;
drop policy if exists "Newsroom generation owners can delete own generations"
  on public.newsroom_generations;

create policy "Newsroom generation owners can read own generations"
on public.newsroom_generations for select
using (owner_id = auth.uid());

create policy "Newsroom generation owners can insert own generations"
on public.newsroom_generations for insert
with check (owner_id = auth.uid());

create policy "Newsroom generation owners can update own generations"
on public.newsroom_generations for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Newsroom generation owners can delete own generations"
on public.newsroom_generations for delete
using (owner_id = auth.uid());

drop policy if exists "Newsroom decision owners can read own decisions"
  on public.newsroom_editorial_decisions;
drop policy if exists "Newsroom decision owners can insert own decisions"
  on public.newsroom_editorial_decisions;
drop policy if exists "Newsroom decision owners can update own decisions"
  on public.newsroom_editorial_decisions;
drop policy if exists "Newsroom decision owners can delete own decisions"
  on public.newsroom_editorial_decisions;

create policy "Newsroom decision owners can read own decisions"
on public.newsroom_editorial_decisions for select
using (owner_id = auth.uid() and actor_id = auth.uid());

create policy "Newsroom decision owners can insert own decisions"
on public.newsroom_editorial_decisions for insert
with check (owner_id = auth.uid() and actor_id = auth.uid());

create policy "Newsroom decision owners can update own decisions"
on public.newsroom_editorial_decisions for update
using (false)
with check (false);

create policy "Newsroom decision owners can delete own decisions"
on public.newsroom_editorial_decisions for delete
using (false);

create or replace function public.set_newsroom_generations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists newsroom_generations_set_updated_at
  on public.newsroom_generations;

create trigger newsroom_generations_set_updated_at
before update on public.newsroom_generations
for each row
execute function public.set_newsroom_generations_updated_at();
