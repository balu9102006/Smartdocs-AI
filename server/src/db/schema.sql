-- ==============================================================================
-- SMARTDOCS AI - Complete Supabase Database Schema with pgvector & RLS
-- ==============================================================================

-- 1. Enable pgvector extension for similarity search
create extension if not exists vector;

-- 2. Documents Table
-- Stores metadata of uploaded PDF and DOCX files
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null, -- 'pdf' or 'docx'
  file_size bigint not null,
  storage_path text not null,
  status text not null default 'uploaded', -- 'uploaded', 'processing', 'ready', 'error'
  error_message text,
  total_pages int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Document Chunks Table with Vector Embeddings
-- Stores segmented text passages along with 1536-dimensional embeddings
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  page_number int,
  embedding vector(1536), -- Standard embedding dimension (e.g. OpenAI / text-embedding-3 / BAAI)
  created_at timestamptz default now()
);

-- Create HNSW index for ultra-fast approximate nearest neighbor vector search
create index if not exists idx_document_chunks_embedding
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Index for quick chunk filtering by document
create index if not exists idx_document_chunks_document_id
  on public.document_chunks (document_id);

-- 4. Chat Sessions Table
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  title text not null default 'New Conversation',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Chat Messages Table
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  sources jsonb, -- JSON array of cited chunk metadata: [{chunkId, page, text}]
  created_at timestamptz default now()
);

create index if not exists idx_chat_messages_session_id
  on public.chat_messages (session_id);

-- 6. Vector Similarity Search RPC Function
-- Used by the backend to retrieve the top-k most relevant chunks for a user's question
create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.65,
  match_count int default 5,
  p_user_id uuid default null,
  p_doc_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  page_number int,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on dc.document_id = d.id
  where (p_user_id is null or d.user_id = p_user_id)
    and (p_doc_id is null or d.id = p_doc_id)
    and (1 - (dc.embedding <=> query_embedding)) > match_threshold
  order by similarity desc
  limit match_count;
$$;

-- ==============================================================================
-- 7. Row Level Security (RLS) Policies
-- Ensures users can only access their own documents, chunks, and chats
-- ==============================================================================

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- Documents RLS
create policy "Users can view their own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "Users can insert their own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own documents"
  on public.documents for update
  using (auth.uid() = user_id);

create policy "Users can delete their own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

-- Document Chunks RLS
create policy "Users can view chunks belonging to their documents"
  on public.document_chunks for select
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id
        and d.user_id = auth.uid()
    )
  );

create policy "Users can insert chunks to their documents"
  on public.document_chunks for insert
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id
        and d.user_id = auth.uid()
    )
  );

create policy "Users can delete chunks belonging to their documents"
  on public.document_chunks for delete
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id
        and d.user_id = auth.uid()
    )
  );

-- Chat Sessions RLS
create policy "Users can view their own chat sessions"
  on public.chat_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chat sessions"
  on public.chat_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own chat sessions"
  on public.chat_sessions for delete
  using (auth.uid() = user_id);

-- Chat Messages RLS
create policy "Users can view messages from their sessions"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can insert messages into their sessions"
  on public.chat_messages for insert
  with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id
        and s.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- 8. Supabase Storage Setup (Run in Supabase Dashboard -> Storage)
-- ==============================================================================
-- Bucket name: 'documents' (Private bucket)
-- Storage policy:
-- Allow authenticated users to upload files to their own folder:
-- (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1])

