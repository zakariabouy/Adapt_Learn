-- Migration 006_rag_vectors.sql
-- RAG (Retrieval-Augmented Generation) support via pgvector
-- Enables semantic search across pedagogical content

-- Enable pgvector extension (requires pgvector/pgvector Docker image)
CREATE EXTENSION IF NOT EXISTS vector;

-- Content chunks with embeddings for RAG retrieval
-- Each content_item is split into overlapping chunks, each embedded
CREATE TABLE IF NOT EXISTS content_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(768),          -- Gemini text-embedding-004 outputs 768 dimensions
    metadata JSONB DEFAULT '{}',    -- Extra info: char_count, subject, grade_level
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast content-scoped lookups
CREATE INDEX IF NOT EXISTS idx_chunks_content_id
ON content_chunks(content_id);

-- HNSW index for approximate nearest-neighbor cosine search
-- Faster than exact scan for large datasets; works on empty tables
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
ON content_chunks USING hnsw (embedding vector_cosine_ops);
