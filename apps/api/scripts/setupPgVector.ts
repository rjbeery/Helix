import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating pgvector extension and embeddings table...');

  // Enable pgvector extension
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
  console.log('✓ pgvector extension enabled');

  // Create embeddings table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      embedding vector(1536) NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✓ embeddings table created');

  // Create HNSW index for fast vector similarity search
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS embeddings_embedding_idx 
    ON embeddings 
    USING hnsw (embedding vector_cosine_ops);
  `);
  console.log('✓ HNSW index created for vector similarity');

  // Create GIN index on metadata for fast filtering
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS embeddings_metadata_idx 
    ON embeddings 
    USING gin (metadata);
  `);
  console.log('✓ GIN index created for metadata filtering');

  // Create index on created_at
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS embeddings_created_at_idx 
    ON embeddings (created_at DESC);
  `);
  console.log('✓ created_at index created');

  console.log('\n✅ pgvector setup complete!');
}

main()
  .catch((e) => {
    console.error('Error setting up pgvector:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
