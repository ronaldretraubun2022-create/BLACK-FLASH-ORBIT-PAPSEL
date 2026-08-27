alter table public.chat_sessions
  add column if not exists pinned boolean not null default false;

create index if not exists chat_sessions_user_pinned_created_idx
  on public.chat_sessions (user_id, pinned desc, created_at desc);
