import { Client } from 'pg';

async function enablePgVector() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false } // RDS requires SSL
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected');

    console.log('\n📦 Enabling pgvector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ pgvector extension enabled');

    console.log('\n🗄️  Creating embeddings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector(1536) NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Embeddings table created');

    console.log('\n📇 Creating HNSW index for vector similarity...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS embeddings_embedding_idx 
      ON embeddings 
      USING hnsw (embedding vector_cosine_ops);
    `);
    console.log('✅ HNSW index created');

    console.log('\n📇 Creating GIN index for metadata filtering...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS embeddings_metadata_idx 
      ON embeddings 
      USING gin (metadata);
    `);
    console.log('✅ GIN index created');

    console.log('\n📇 Creating created_at index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS embeddings_created_at_idx 
      ON embeddings (created_at DESC);
    `);
    console.log('✅ created_at index created');

    console.log('\n✅ pgvector setup complete!');
    console.log('\nYou can now use RAG with PostgreSQL backend (VECTOR_STORE_TYPE=postgres)');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

enablePgVector();
