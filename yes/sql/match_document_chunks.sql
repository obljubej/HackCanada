-- Run this in your Supabase SQL editor to add chunk search
create or replace function match_document_chunks (
  query_embedding vector(3072),
  match_user_id text,
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  similarity double precision,
  metadata jsonb
)
language sql
as $$
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    c.metadata
  from document_chunks c
  where c.user_id = match_user_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
