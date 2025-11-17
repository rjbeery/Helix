# RAG Deployment Checklist

## ✅ Completed

1. **Code Implementation**
   - ✅ Created `@helix/memory` package with dual backend support
   - ✅ Implemented `PineconeVectorStore` for cloud option
   - ✅ Implemented `PostgresVectorStore` for self-hosted option
   - ✅ Added `/v1/rag/*` API endpoints (ingest, query, delete)
   - ✅ Integrated RAG into chat flow with `useRag` flag
   - ✅ Auto-detection via `VECTOR_STORE_TYPE` env var
   - ✅ Local config set to `postgres` backend
   - ✅ Comprehensive documentation created

2. **Files Added/Modified**
   - New package: `packages/memory/`
   - New routes: `apps/api/src/routes/rag.ts`
   - Modified: `apps/api/src/routes/chat.ts` (RAG integration)
   - Modified: `packages/orchestrator/runTurn.ts` (context injection)
   - Migration: `apps/api/prisma/migrations/create_pgvector_embeddings.sql`
   - Setup script: `apps/api/scripts/setupPgVector.ts`
   - Test script: `apps/api/scripts/testRAG.ts`
   - Docs: `docs/RAG_IMPLEMENTATION.md`

3. **Git**
   - ✅ Changes committed to main branch
   - Commit: "Add RAG with dual backend support (Pinecone/pgvector)"

## ⏳ Deployment Steps Required

### 1. Database Setup (Aurora PostgreSQL)

Run this script on your Aurora instance:

```bash
# Option A: Using setupPgVector.ts (recommended)
pnpm -C apps/api exec tsx scripts/setupPgVector.ts

# Option B: Direct SQL
psql $DATABASE_URL -f apps/api/prisma/migrations/create_pgvector_embeddings.sql
```

This will:
- Enable the `vector` extension
- Create the `embeddings` table
- Set up HNSW and GIN indexes

### 2. Environment Variables

Add to Lambda/Secrets Manager:

```bash
VECTOR_STORE_TYPE=postgres  # Use pgvector (already set locally)
# DATABASE_URL is already configured for Prisma
```

**Optional**: If you want to use Pinecone instead:

```bash
VECTOR_STORE_TYPE=pinecone
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=helix-knowledge
PINECONE_NAMESPACE=default  # Optional
```

### 3. Build and Deploy

```powershell
# Rebuild packages
pnpm install
pnpm -w build

# Build and deploy Docker image
docker build -f Dockerfile.api -t helixsource-api-lambda:latest-lambda .
# ... tag and push to ECR
# ... update Lambda
```

### 4. Test RAG Endpoints

#### A. Ingest a document

```bash
curl -X POST https://api.helixai.live/v1/rag/ingest \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "test-doc",
    "content": "Helix is a GenAI platform that supports Claude, GPT-4, and other models.",
    "metadata": { "source": "test" }
  }'
```

#### B. Query for context

```bash
curl -X POST https://api.helixai.live/v1/rag/query \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What models does Helix support?",
    "topK": 3
  }'
```

#### C. Use in chat

```bash
curl -X POST https://api.helixai.live/api/chat \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "personaId": "default",
    "message": "What models does Helix support?",
    "useRag": true
  }'
```

#### D. Delete document

```bash
curl -X DELETE https://api.helixai.live/v1/rag/document \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "test-doc"
  }'
```

## 🎯 Key Features

### Automatic Backend Selection

The system automatically chooses the backend based on `VECTOR_STORE_TYPE`:

- `postgres` (default) - Uses Aurora with pgvector extension
- `pinecone` - Uses Pinecone cloud service

### Smart Initialization

The PostgresVectorStore automatically:
1. Creates the `embeddings` table if it doesn't exist
2. Enables the `vector` extension if needed
3. Sets up optimized indexes (HNSW for vectors, GIN for metadata)

### User-Scoped Access

Documents are automatically filtered by user:
- Non-admin users only see their own documents
- Admins can see all documents (optional filter)

### Cost Comparison

**PostgreSQL pgvector:**
- One-time embedding cost: ~$0.01 per 1000 documents
- No recurring costs (uses existing Aurora)
- Storage: ~100KB per 1000 embeddings

**Pinecone:**
- One-time embedding cost: ~$0.01 per 1000 documents  
- Monthly storage: ~$0.40 per 100K vectors
- Query costs: ~$0.40 per 1M queries

## 📋 Next Actions

1. ✅ Code committed and ready
2. ⏳ Run pgvector migration on Aurora
3. ⏳ Rebuild and deploy Lambda
4. ⏳ Test RAG endpoints in production
5. ⏳ (Optional) Build UI for document management

## 🔧 Troubleshooting

### Can't connect to database

Check that:
- PostgreSQL is running
- `DATABASE_URL` is correct
- pgvector extension is installed (`CREATE EXTENSION vector;`)

### Embeddings failing

Check that:
- `OPENAI_API_KEY` is set and valid
- API has quota available

### Switching backends

To switch from Postgres to Pinecone:

```bash
# 1. Set env var
VECTOR_STORE_TYPE=pinecone

# 2. Add Pinecone credentials
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=helix-knowledge

# 3. Re-ingest documents (data is not migrated automatically)
```

## 📚 Documentation

- `docs/RAG_IMPLEMENTATION.md` - Complete setup and architecture guide
- `packages/memory/README.md` - Package API documentation
- `apps/api/src/routes/rag.ts` - API endpoint implementation
