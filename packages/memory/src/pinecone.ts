import { Pinecone } from '@pinecone-database/pinecone';
import type { VectorStore, VectorDocument, QueryResult, Embedder } from './types.js';

export interface PineconeConfig {
  apiKey?: string;
  indexName: string;
  namespace?: string;
  embedder: Embedder;
}

/**
 * Pinecone vector store implementation for RAG
 */
export class PineconeVectorStore implements VectorStore {
  private client: Pinecone;
  private indexName: string;
  private namespace: string;
  private embedder: Embedder;

  constructor(config: PineconeConfig) {
    const apiKey = config.apiKey || process.env.PINECONE_API_KEY || '';
    if (!apiKey) {
      throw new Error('Pinecone API key required');
    }

    this.client = new Pinecone({ apiKey });
    this.indexName = config.indexName;
    this.namespace = config.namespace || 'default';
    this.embedder = config.embedder;
  }

  /**
   * Upsert documents into Pinecone
   */
  async upsert(documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) return;

    const index = this.client.index(this.indexName);

    // Generate embeddings for documents that don't have them
    const textsToEmbed = documents
      .filter(doc => !doc.embedding)
      .map(doc => doc.content);

    let embeddings: number[][] = [];
    if (textsToEmbed.length > 0) {
      embeddings = await this.embedder.embed(textsToEmbed);
    }

    let embeddingIndex = 0;
    const vectors = documents.map(doc => {
      const embedding = doc.embedding || embeddings[embeddingIndex++];
      return {
        id: doc.id,
        values: embedding,
        metadata: {
          content: doc.content,
          ...doc.metadata,
        },
      };
    });

    // Pinecone batch limit is typically 100
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.namespace(this.namespace).upsert(batch);
    }
  }

  /**
   * Query Pinecone for similar documents
   */
  async query(
    queryText: string,
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<QueryResult[]> {
    const index = this.client.index(this.indexName);
    
    // Generate embedding for query
    const queryEmbedding = await this.embedder.embedSingle(queryText);

    const queryResponse = await index.namespace(this.namespace).query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter,
    });

    return (queryResponse.matches || []).map(match => ({
      id: match.id,
      content: (match.metadata?.content as string) || '',
      score: match.score || 0,
      metadata: match.metadata,
    }));
  }

  /**
   * Delete documents by ID
   */
  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const index = this.client.index(this.indexName);
    await index.namespace(this.namespace).deleteMany(ids);
  }

  /**
   * Delete all documents in namespace (use with caution)
   */
  async deleteAll(): Promise<void> {
    const index = this.client.index(this.indexName);
    await index.namespace(this.namespace).deleteAll();
  }
}
