do $$
begin
  if to_regclass('public.orbit_prompts') is not null then
    alter table public.orbit_prompts
      add column if not exists user_id uuid references auth.users(id) on delete cascade;

    alter table public.orbit_prompts
      add column if not exists created_by uuid references auth.users(id) on delete set null;

    update public.orbit_prompts
      set created_by = coalesce(created_by, user_id)
      where created_by is null and user_id is not null;

    execute 'create index if not exists orbit_prompts_user_id_idx on public.orbit_prompts (user_id)';
    execute 'create index if not exists orbit_prompts_created_by_idx on public.orbit_prompts (created_by)';

    alter table public.orbit_prompts enable row level security;

    drop policy if exists orbit_prompts_select_own on public.orbit_prompts;
    drop policy if exists orbit_prompts_insert_own on public.orbit_prompts;
    drop policy if exists orbit_prompts_update_own on public.orbit_prompts;
    drop policy if exists orbit_prompts_delete_own on public.orbit_prompts;

    create policy orbit_prompts_select_own
      on public.orbit_prompts
      for select
      using (auth.uid() = user_id or auth.uid() = created_by);

    create policy orbit_prompts_insert_own
      on public.orbit_prompts
      for insert
      with check (auth.uid() = user_id and auth.uid() = created_by);

    create policy orbit_prompts_update_own
      on public.orbit_prompts
      for update
      using (auth.uid() = user_id or auth.uid() = created_by)
      with check (auth.uid() = user_id and auth.uid() = created_by);

    create policy orbit_prompts_delete_own
      on public.orbit_prompts
      for delete
      using (auth.uid() = user_id or auth.uid() = created_by);
  end if;
end $$;
