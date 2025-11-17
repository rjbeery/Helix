# RAG Implementation Summary

## What Was Added

Helix now includes RAG (Retrieval-Augmented Generation) with support for **two vector backends**:
1. **Pinecone** - Fully managed cloud vector database
2. **PostgreSQL pgvector** - Self-hosted vector storage

Choose your backend via the `VECTOR_STORE_TYPE` environment variable.

### New Package: `@helix/memory`

Location: `packages/memory/`

**Files Created:**
- `src/types.ts` - TypeScript interfaces for embeddings, vector stores, documents
- `src/embedder.ts` - OpenAI embedding implementation (text-embedding-3-small)
- `src/pinecone.ts` - Pinecone vector store with upsert, query, delete operations
- `src/chunking.ts` - Smart text chunking with overlap for better retrieval
- `src/index.ts` - Main exports and factory function
- `README.md` - Complete documentation

### New API Routes: `/v1/rag/*`

Location: `apps/api/src/routes/rag.ts`

**Endpoints:**
- `POST /v1/rag/ingest` - Upload and index documents (auto-chunked)
- `POST /v1/rag/query` - Search vector database for relevant context
- `DELETE /v1/rag/document` - Remove document and all chunks

### Chat Integration

**Modified Files:**
- `apps/api/src/routes/chat.ts` - Added optional `useRag` flag to chat requests
- `packages/orchestrator/runTurn.ts` - Added `ragContext` injection into prompts

**How It Works:**
When `useRag: true` is sent with a chat message, the system:
1. Retrieves top 3 relevant chunks from user's knowledge base
2. Injects them as context before the user's question
3. LLM generates answer using both conversation history + retrieved knowledge

### Environment Variables Required

#### Option 1: Pinecone (Cloud)

```bash
VECTOR_STORE_TYPE=pinecone         # Default if not set
PINECONE_API_KEY=pcsk_...          # From https://app.pinecone.io/
PINECONE_INDEX_NAME=helix-knowledge # Your index name
PINECONE_NAMESPACE=default          # Optional namespace
OPENAI_API_KEY=sk-...              # For embeddings
```

#### Option 2: PostgreSQL pgvector (Self-hosted)

```bash
VECTOR_STORE_TYPE=postgres
DATABASE_URL=postgresql://...      # Your existing Postgres connection
OPENAI_API_KEY=sk-...              # For embeddings
```

## Quick Start

### Option A: Using Pinecone

#### 1. Set Up Pinecone

```bash
# Visit https://app.pinecone.io/
# Create index:
#   Name: helix-knowledge
#   Dimensions: 1536
#   Metric: cosine
```

#### 2. Add Environment Variables

```bash
VECTOR_STORE_TYPE=pinecone
PINECONE_API_KEY=your-key
PINECONE_INDEX_NAME=helix-knowledge
```

### Option B: Using PostgreSQL

#### 1. Enable pgvector Extension

```bash
# Run migration script
psql $DATABASE_URL -f apps/api/prisma/migrations/create_pgvector_embeddings.sql
```

Or manually:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 2. Add Environment Variable

```bash
VECTOR_STORE_TYPE=postgres
# DATABASE_URL should already be set for Prisma
```

The PostgreSQL backend will auto-create the `embeddings` table on first use.

### Common Steps (Both Backends)

#### 1. Ingest Documents

```bash
curl -X POST https://api.helixai.live/v1/rag/ingest \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "company-handbook",
    "content": "Your document content here...",
    "metadata": { "title": "Employee Handbook", "version": "2025" }
  }'
```

#### 2. Use in Chat

```bash
curl -X POST https://api.helixai.live/api/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "personaId": "your-persona-id",
    "message": "What is the vacation policy?",
    "useRag": true
  }'
```

## Next Steps for Production

### For Pinecone Deployment

```bash
aws lambda update-function-configuration \
  --function-name helixai-api \
  --environment "Variables={...,VECTOR_STORE_TYPE=pinecone,PINECONE_API_KEY=pcsk_...,PINECONE_INDEX_NAME=helix-knowledge}"
```

### For PostgreSQL Deployment

```bash
# 1. Enable pgvector in your Aurora/RDS instance
psql $DATABASE_URL -f apps/api/prisma/migrations/create_pgvector_embeddings.sql

# 2. Set environment variable
aws lambda update-function-configuration \
  --function-name helixai-api \
  --environment "Variables={...,VECTOR_STORE_TYPE=postgres}"
```

## Switching Backends

You can switch between Pinecone and PostgreSQL at any time by changing `VECTOR_STORE_TYPE`:

```bash
# Use Pinecone
export VECTOR_STORE_TYPE=pinecone

# Use PostgreSQL
export VECTOR_STORE_TYPE=postgres
```

**Note:** Data is not automatically migrated between backends. If you switch, you'll need to re-ingest documents.

## Additional Features

- Document upload interface
- RAG toggle in chat UI
- Knowledge base management page

## Architecture

```
┌─────────────┐
│   User      │
│  Question   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  1. Embed question (OpenAI)     │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  2. Query Vector Store (cosine search)  │
│     → Pinecone or PostgreSQL pgvector   │
│     → Returns top K similar chunks      │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  3. Inject context into prompt  │
│     Context: [chunk 1][chunk 2] │
│     Question: <user message>    │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  4. LLM completion with context │
└──────┬──────────────────────────┘
       │
       ▼
   Answer
```

## Cost Estimates

### Pinecone Backend

**For 1000 documents (average 500 tokens each):**
- Embedding: ~$0.01 (one-time)
- Storage: ~$0.40/month (Pinecone)
- Queries: ~$0.40 per 1M queries

**Total: ~$0.80/month for 1000 documents**

### PostgreSQL Backend

**For 1000 documents (average 500 tokens each):**
- Embedding: ~$0.01 (one-time)
- Storage: ~100KB in database (negligible)
- Queries: No additional cost (uses your DB)

**Total: ~$0.01 one-time, no recurring costs**

## Performance Comparison

| Metric | Pinecone | PostgreSQL pgvector |
|--------|----------|---------------------|
| Query Latency | ~50-100ms | ~100-200ms |
| Scalability | Excellent (100M+ vectors) | Good (10M+ vectors) |
| Setup Complexity | Low | Medium |
| Monthly Cost (100K docs) | ~$40 | ~$0 |
| Index Build Time | Immediate | Fast (HNSW) |
