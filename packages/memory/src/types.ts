/**
 * Vector embedding and retrieval types for RAG
 */

export interface EmbeddingConfig {
  apiKey?: string;
  model?: string;
  dimensions?: number;
}

export interface VectorDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface QueryResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface VectorStore {
  upsert(documents: VectorDocument[]): Promise<void>;
  query(queryText: string, topK?: number, filter?: Record<string, any>): Promise<QueryResult[]>;
  delete(ids: string[]): Promise<void>;
}

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
  embedSingle(text: string): Promise<number[]>;
}
