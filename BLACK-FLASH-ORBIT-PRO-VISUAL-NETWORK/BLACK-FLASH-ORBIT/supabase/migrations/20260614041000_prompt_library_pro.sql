alter table public.orbit_prompts
  add column if not exists is_pinned boolean not null default false;

alter table public.orbit_prompts
  add column if not exists usage_count integer not null default 0;

alter table public.orbit_prompts
  add column if not exists last_used_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orbit_prompts_usage_count_nonnegative'
  ) then
    alter table public.orbit_prompts
      add constraint orbit_prompts_usage_count_nonnegative
      check (usage_count >= 0);
  end if;
end $$;

create index if not exists orbit_prompts_user_pin_favorite_updated_idx
  on public.orbit_prompts (
    user_id,
    is_pinned desc,
    is_favorite desc,
    updated_at desc
  );

create index if not exists orbit_prompts_user_email_pin_favorite_updated_idx
  on public.orbit_prompts (
    lower(user_email),
    is_pinned desc,
    is_favorite desc,
    updated_at desc
  );

create index if not exists orbit_prompts_last_used_idx
  on public.orbit_prompts (last_used_at desc)
  where last_used_at is not null;
