-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table for RAG document storage
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW index for fast vector similarity search
-- HNSW (Hierarchical Navigable Small World) is optimized for large datasets
-- Using cosine distance for similarity (vector_cosine_ops)
CREATE INDEX IF NOT EXISTS embeddings_embedding_idx 
ON embeddings 
USING hnsw (embedding vector_cosine_ops);

-- Create GIN index on metadata for fast filtering
-- Allows efficient filtering by userId, documentId, or other metadata fields
CREATE INDEX IF NOT EXISTS embeddings_metadata_idx 
ON embeddings 
USING gin (metadata);

-- Optional: Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS embeddings_created_at_idx 
ON embeddings (created_at DESC);
