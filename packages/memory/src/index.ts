export * from './types.js';
export * from './embedder.js';
export * from './pinecone.js';
export * from './postgres.js';
export * from './chunking.js';

import { OpenAIEmbedder } from './embedder.js';
import { PineconeVectorStore } from './pinecone.js';
import { PostgresVectorStore } from './postgres.js';
import type { EmbeddingConfig, VectorStore } from './types.js';

export type VectorStoreType = 'pinecone' | 'postgres';

export interface VectorStoreConfig {
  // Common config
  storeType?: VectorStoreType;
  openaiApiKey?: string;
  embeddingModel?: string;
  
  // Pinecone config
  pineconeApiKey?: string;
  pineconeIndexName?: string;
  pineconeNamespace?: string;
  
  // Postgres config
  postgresConnectionString?: string;
  postgresHost?: string;
  postgresPort?: number;
  postgresDatabase?: string;
  postgresUser?: string;
  postgresPassword?: string;
  postgresTableName?: string;
}

/**
 * Factory to create a configured vector store instance
 * Supports both Pinecone and PostgreSQL pgvector backends
 * 
 * @example
 * // Use Pinecone
 * const store = createVectorStore({
 *   storeType: 'pinecone',
 *   pineconeApiKey: 'pcsk_...',
 *   pineconeIndexName: 'helix-knowledge'
 * });
 * 
 * @example
 * // Use Postgres
 * const store = createVectorStore({
 *   storeType: 'postgres',
 *   postgresConnectionString: 'postgresql://...'
 * });
 */
export function createVectorStore(config: VectorStoreConfig): VectorStore {
  const embedder = new OpenAIEmbedder({
    apiKey: config.openaiApiKey,
    model: config.embeddingModel || 'text-embedding-3-small',
  });

  // Determine store type from config or environment
  const storeType = config.storeType || 
    (process.env.VECTOR_STORE_TYPE as VectorStoreType) || 
    'pinecone';

  if (storeType === 'postgres') {
    return new PostgresVectorStore({
      connectionString: config.postgresConnectionString || process.env.DATABASE_URL,
      host: config.postgresHost || process.env.PGHOST,
      port: config.postgresPort || (process.env.PGPORT ? parseInt(process.env.PGPORT) : undefined),
      database: config.postgresDatabase || process.env.PGDATABASE,
      user: config.postgresUser || process.env.PGUSER,
      password: config.postgresPassword || process.env.PGPASSWORD,
      tableName: config.postgresTableName,
      embedder,
    });
  }

  // Default to Pinecone
  return new PineconeVectorStore({
    apiKey: config.pineconeApiKey,
    indexName: config.pineconeIndexName || process.env.PINECONE_INDEX_NAME || 'helix-knowledge',
    namespace: config.pineconeNamespace || process.env.PINECONE_NAMESPACE,
    embedder,
  });
}
