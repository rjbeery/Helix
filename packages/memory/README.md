# @helix/memory

RAG (Retrieval-Augmented Generation) implementation with support for multiple vector backends.

## Features

- **Multiple Backends**: Choose between Pinecone or PostgreSQL pgvector
- **Vector Storage**: Store and retrieve document embeddings
- **Text Chunking**: Intelligent document chunking with overlap for better retrieval
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions, fast & cheap)
- **RAG Integration**: Seamlessly inject retrieved context into LLM prompts

## Supported Backends

### Pinecone (Cloud)
- ✅ Fully managed vector database
- ✅ Fast and scalable
- ✅ Simple setup
- ❌ Additional cost ($0.40/month per 100K vectors)

### PostgreSQL pgvector (Self-hosted)
- ✅ Use existing database infrastructure
- ✅ No additional cost
- ✅ Full control over data
- ❌ Requires manual database setup

## Setup

### Option 1: Pinecone Backend

#### 1. Create Pinecone Index

```bash
# Visit https://app.pinecone.io/
# Create a new index with:
#   - Name: helix-knowledge (or custom via PINECONE_INDEX_NAME)
#   - Dimensions: 1536
#   - Metric: cosine
#   - Cloud: AWS (us-east-1 recommended)
```

#### 2. Environment Variables

```bash
VECTOR_STORE_TYPE=pinecone  # Default if not set
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=helix-knowledge
PINECONE_NAMESPACE=default  # Optional, isolate data by namespace
OPENAI_API_KEY=your-openai-api-key  # For embeddings
```

### Option 2: PostgreSQL pgvector Backend

#### 1. Enable pgvector Extension

```sql
-- Connect to your database and run:
CREATE EXTENSION IF NOT EXISTS vector;
```

Or use the provided migration script:

```bash
psql $DATABASE_URL -f apps/api/prisma/migrations/create_pgvector_embeddings.sql
```

#### 2. Environment Variables

```bash
VECTOR_STORE_TYPE=postgres
DATABASE_URL=postgresql://user:password@host:port/database
OPENAI_API_KEY=your-openai-api-key  # For embeddings
```

The PostgreSQL backend will automatically:
- Create the `embeddings` table if it doesn't exist
- Set up HNSW index for fast similarity search
- Create GIN index on metadata for efficient filtering

## API Usage

### Ingest Documents

```bash
POST /v1/rag/ingest
Authorization: Bearer <token>
Content-Type: application/json

{
  "documentId": "doc-123",
  "content": "Your document content here...",
  "metadata": {
    "title": "Document Title",
    "source": "upload"
  },
  "chunkSize": 1000,  // Optional, default 1000
  "overlap": 200      // Optional, default 200
}
```

### Query Documents

```bash
POST /v1/rag/query
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "What is RAG?",
  "topK": 5,  // Optional, default 5
  "filter": {  // Optional metadata filters
    "source": "upload"
  }
}
```

### Delete Documents

```bash
DELETE /v1/rag/document
Authorization: Bearer <token>
Content-Type: application/json

{
  "documentId": "doc-123"
}
```

### Use RAG in Chat

```bash
POST /api/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "personaId": "persona-id",
  "message": "Your question here",
  "conversationId": "optional-conv-id",
  "useRag": true  // Enable RAG retrieval
}
```

## Programmatic Usage

### Using Pinecone

```typescript
import { createVectorStore, chunkText, generateChunkId } from '@helix/memory';

// Initialize with Pinecone
const vectorStore = createVectorStore({
  storeType: 'pinecone',
  pineconeApiKey: process.env.PINECONE_API_KEY!,
  pineconeIndexName: 'helix-knowledge',
  pineconeNamespace: 'default',
  openaiApiKey: process.env.OPENAI_API_KEY!,
});

// Chunk and ingest
const content = "Your long document...";
const chunks = chunkText(content, { maxChunkSize: 1000, overlap: 200 });

const documents = chunks.map((chunk, i) => ({
  id: generateChunkId('doc-123', i),
  content: chunk,
  metadata: { documentId: 'doc-123', chunkIndex: i }
}));

await vectorStore.upsert(documents);

// Query
const results = await vectorStore.query("search query", 5);
console.log(results); // Array of { id, content, score, metadata }

// Delete
await vectorStore.delete(['doc-123_chunk_0', 'doc-123_chunk_1']);
```

### Using PostgreSQL pgvector

```typescript
import { createVectorStore, chunkText, generateChunkId } from '@helix/memory';

// Initialize with Postgres
const vectorStore = createVectorStore({
  storeType: 'postgres',
  postgresConnectionString: process.env.DATABASE_URL!,
  postgresTableName: 'embeddings', // Optional, defaults to 'embeddings'
  openaiApiKey: process.env.OPENAI_API_KEY!,
});

// Auto-initialization (creates table and indexes if needed)
// This happens automatically on first use

// Rest is identical to Pinecone
const content = "Your long document...";
const chunks = chunkText(content, { maxChunkSize: 1000, overlap: 200 });

const documents = chunks.map((chunk, i) => ({
  id: generateChunkId('doc-123', i),
  content: chunk,
  metadata: { documentId: 'doc-123', chunkIndex: i }
}));

await vectorStore.upsert(documents);
const results = await vectorStore.query("search query", 5);
```

### Auto-Detection from Environment

```typescript
// Automatically uses VECTOR_STORE_TYPE env var
const vectorStore = createVectorStore({
  // Will use 'pinecone' or 'postgres' based on VECTOR_STORE_TYPE
  // Pinecone config (ignored if using postgres)
  pineconeApiKey: process.env.PINECONE_API_KEY,
  pineconeIndexName: process.env.PINECONE_INDEX_NAME || 'helix-knowledge',
  // Postgres config (ignored if using pinecone)
  postgresConnectionString: process.env.DATABASE_URL,
  // Common config
  openaiApiKey: process.env.OPENAI_API_KEY!,
});
```

## Pricing

### Pinecone
- Serverless plan: ~$0.0004 per 1000 queries + $0.40/month per 100K vectors
- Example: 100K documents stored + 1M queries/month = ~$1/month

### PostgreSQL pgvector
- No additional cost (uses your existing database)
- Storage: ~100KB per 1000 embeddings
- Performance depends on your database instance

### OpenAI Embeddings
- text-embedding-3-small: $0.02 per 1M tokens
- Example: Embedding 100 documents (500KB total) costs ~$0.01

## Choosing a Backend

| Factor | Pinecone | PostgreSQL |
|--------|----------|------------|
| Setup | ⭐⭐⭐ Easy | ⭐⭐ Moderate |
| Performance | ⭐⭐⭐ Excellent | ⭐⭐ Good |
| Cost (small scale) | ⭐⭐ $0.40+/month | ⭐⭐⭐ Free |
| Cost (large scale) | ⭐⭐ Scales with usage | ⭐⭐⭐ Fixed DB cost |
| Control | ⭐⭐ Managed | ⭐⭐⭐ Full control |

**Recommendation:**
- **Use Pinecone** if you want fast setup and don't have database infrastructure
- **Use PostgreSQL** if you're already using Postgres and want to minimize dependencies
