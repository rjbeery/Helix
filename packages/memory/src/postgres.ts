import { Pool, PoolClient } from 'pg';
import type { VectorStore, VectorDocument, QueryResult, Embedder } from './types.js';

export interface PostgresConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  embedder: Embedder;
  tableName?: string;
}

/**
 * PostgreSQL pgvector store implementation for RAG
 * Requires pgvector extension installed in the database
 */
export class PostgresVectorStore implements VectorStore {
  private pool: Pool;
  private embedder: Embedder;
  private tableName: string;
  private isInitialized = false;

  constructor(config: PostgresConfig) {
    // Use connection string if provided, otherwise build from parts
    const connectionString = config.connectionString || 
      `postgresql://${config.user}:${config.password}@${config.host}:${config.port || 5432}/${config.database}`;

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.embedder = config.embedder;
    this.tableName = config.tableName || 'embeddings';
  }

  /**
   * Initialize the database table and pgvector extension
   * Should be called once on startup or deployment
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const client = await this.pool.connect();
    try {
      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

      // Create embeddings table with vector column
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          embedding vector(1536) NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Create index for vector similarity search (HNSW is fast for large datasets)
      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.tableName}_embedding_idx 
        ON ${this.tableName} 
        USING hnsw (embedding vector_cosine_ops);
      `);

      // Create GIN index on metadata for fast filtering
      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.tableName}_metadata_idx 
        ON ${this.tableName} 
        USING gin (metadata);
      `);

      this.isInitialized = true;
    } finally {
      client.release();
    }
  }

  /**
   * Upsert documents into PostgreSQL
   */
  async upsert(documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) return;
    
    await this.initialize();

    // Generate embeddings for documents that don't have them
    const textsToEmbed = documents
      .filter(doc => !doc.embedding)
      .map(doc => doc.content);

    let embeddings: number[][] = [];
    if (textsToEmbed.length > 0) {
      embeddings = await this.embedder.embed(textsToEmbed);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let embeddingIndex = 0;
      for (const doc of documents) {
        const embedding = doc.embedding || embeddings[embeddingIndex++];
        
        await client.query(
          `
          INSERT INTO ${this.tableName} (id, content, embedding, metadata)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) 
          DO UPDATE SET 
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            metadata = EXCLUDED.metadata
          `,
          [
            doc.id,
            doc.content,
            JSON.stringify(embedding), // pgvector accepts JSON array
            JSON.stringify(doc.metadata || {}),
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Query PostgreSQL for similar documents using cosine similarity
   */
  async query(
    queryText: string,
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<QueryResult[]> {
    await this.initialize();

    // Generate embedding for query
    const queryEmbedding = await this.embedder.embedSingle(queryText);

    const client = await this.pool.connect();
    try {
      // Build WHERE clause for metadata filtering
      let whereClause = '';
      const params: any[] = [JSON.stringify(queryEmbedding), topK];

      if (filter && Object.keys(filter).length > 0) {
        // Build JSONB filter conditions
        const conditions = Object.entries(filter).map(([key, value], index) => {
          params.push(JSON.stringify(value));
          return `metadata->>'${key}' = $${params.length}`;
        });
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      // Use cosine distance for similarity (lower is more similar)
      // 1 - cosine_distance gives us similarity score (higher is more similar)
      const result = await client.query(
        `
        SELECT 
          id,
          content,
          metadata,
          1 - (embedding <=> $1::vector) AS score
        FROM ${this.tableName}
        ${whereClause}
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        `,
        params
      );

      return result.rows.map(row => ({
        id: row.id,
        content: row.content,
        score: parseFloat(row.score),
        metadata: row.metadata,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Delete documents by ID
   */
  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    
    await this.initialize();

    const client = await this.pool.connect();
    try {
      await client.query(
        `DELETE FROM ${this.tableName} WHERE id = ANY($1)`,
        [ids]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Delete all documents (use with caution)
   */
  async deleteAll(): Promise<void> {
    await this.initialize();

    const client = await this.pool.connect();
    try {
      await client.query(`TRUNCATE TABLE ${this.tableName}`);
    } finally {
      client.release();
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
