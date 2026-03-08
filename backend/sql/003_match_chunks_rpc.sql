-- ============================================================
-- match_document_chunks RPC
-- Run this in your Supabase SQL Editor to enable chunk-based
-- semantic retrieval alongside memory_items retrieval.
-- ============================================================

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(3072),
  match_user_id   text,
  match_count     int DEFAULT 5
)
RETURNS TABLE (
  id           uuid,
  document_id  uuid,
  content      text,
  chunk_index  int,
  similarity   float,
  metadata     jsonb
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    document_id,
    content,
    chunk_index,
    1 - (embedding <=> query_embedding) AS similarity,
    metadata
  FROM document_chunks
  WHERE user_id = match_user_id
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
