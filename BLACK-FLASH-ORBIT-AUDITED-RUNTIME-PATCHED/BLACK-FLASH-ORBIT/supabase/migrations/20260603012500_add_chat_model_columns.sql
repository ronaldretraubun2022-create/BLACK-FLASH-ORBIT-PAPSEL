alter table public.chat_sessions
  add column if not exists model text not null default 'openrouter/auto';

alter table public.chat_messages
  add column if not exists model text;

update public.chat_sessions
set model = 'openrouter/auto'
where model is null;
