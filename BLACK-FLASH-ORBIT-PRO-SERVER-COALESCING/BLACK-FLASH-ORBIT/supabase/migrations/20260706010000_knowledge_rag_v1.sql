create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  file_name text,
  file_type text,
  storage_path text,
  status text not null default 'indexed',
  source_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_documents_status_check
    check (status in ('uploaded', 'indexing', 'indexed', 'failed'))
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  owner_id uuid not null,
  chunk_index int not null,
  content text not null,
  token_count int not null default 0,
  embedding vector(1536),
  source_page int,
  citation_label text,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_documents_owner_created_idx
  on public.knowledge_documents (owner_id, created_at desc);

create index if not exists knowledge_chunks_owner_document_idx
  on public.knowledge_chunks (owner_id, document_id, chunk_index);

create index if not exists knowledge_chunks_embedding_hnsw_idx
  on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

drop policy if exists "Knowledge document owners can read own documents"
  on public.knowledge_documents;
drop policy if exists "Knowledge document owners can insert own documents"
  on public.knowledge_documents;
drop policy if exists "Knowledge document owners can update own documents"
  on public.knowledge_documents;
drop policy if exists "Knowledge document owners can delete own documents"
  on public.knowledge_documents;

create policy "Knowledge document owners can read own documents"
on public.knowledge_documents for select
using (owner_id = auth.uid());

create policy "Knowledge document owners can insert own documents"
on public.knowledge_documents for insert
with check (owner_id = auth.uid());

create policy "Knowledge document owners can update own documents"
on public.knowledge_documents for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Knowledge document owners can delete own documents"
on public.knowledge_documents for delete
using (owner_id = auth.uid());

drop policy if exists "Knowledge chunk owners can read own chunks"
  on public.knowledge_chunks;
drop policy if exists "Knowledge chunk owners can insert own chunks"
  on public.knowledge_chunks;
drop policy if exists "Knowledge chunk owners can update own chunks"
  on public.knowledge_chunks;
drop policy if exists "Knowledge chunk owners can delete own chunks"
  on public.knowledge_chunks;

create policy "Knowledge chunk owners can read own chunks"
on public.knowledge_chunks for select
using (owner_id = auth.uid());

create policy "Knowledge chunk owners can insert own chunks"
on public.knowledge_chunks for insert
with check (owner_id = auth.uid());

create policy "Knowledge chunk owners can update own chunks"
on public.knowledge_chunks for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Knowledge chunk owners can delete own chunks"
on public.knowledge_chunks for delete
using (owner_id = auth.uid());

create or replace function public.set_knowledge_documents_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists knowledge_documents_set_updated_at
  on public.knowledge_documents;

create trigger knowledge_documents_set_updated_at
before update on public.knowledge_documents
for each row
execute function public.set_knowledge_documents_updated_at();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'knowledge-documents',
  'knowledge-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/plain'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Knowledge storage owners can read own files"
  on storage.objects;
drop policy if exists "Knowledge storage owners can insert own files"
  on storage.objects;
drop policy if exists "Knowledge storage owners can update own files"
  on storage.objects;
drop policy if exists "Knowledge storage owners can delete own files"
  on storage.objects;

create policy "Knowledge storage owners can read own files"
on storage.objects for select
using (
  bucket_id = 'knowledge-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Knowledge storage owners can insert own files"
on storage.objects for insert
with check (
  bucket_id = 'knowledge-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Knowledge storage owners can update own files"
on storage.objects for update
using (
  bucket_id = 'knowledge-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'knowledge-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Knowledge storage owners can delete own files"
on storage.objects for delete
using (
  bucket_id = 'knowledge-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int,
  owner_filter uuid
)
returns table (
  id uuid,
  document_id uuid,
  owner_id uuid,
  chunk_index int,
  content text,
  token_count int,
  source_page int,
  citation_label text,
  title text,
  source_label text,
  file_name text,
  similarity double precision
)
language sql
stable
as $$
  select
    kc.id,
    kc.document_id,
    kc.owner_id,
    kc.chunk_index,
    kc.content,
    kc.token_count,
    kc.source_page,
    kc.citation_label,
    kd.title,
    kd.source_label,
    kd.file_name,
    (1 - (kc.embedding <=> query_embedding))::double precision as similarity
  from public.knowledge_chunks kc
  join public.knowledge_documents kd on kd.id = kc.document_id
  where
    kc.owner_id = owner_filter
    and kd.owner_id = owner_filter
    and kc.embedding is not null
  order by kc.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 6), 1), 20);
$$;

grant execute on function public.match_knowledge_chunks(
  vector(1536),
  int,
  uuid
) to authenticated, service_role;
