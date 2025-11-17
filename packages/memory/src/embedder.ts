import type { Embedder, EmbeddingConfig } from './types.js';

/**
 * OpenAI Embeddings implementation
 * Uses text-embedding-3-small by default (1536 dimensions, cheap and fast)
 */
export class OpenAIEmbedder implements Embedder {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: EmbeddingConfig = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = config.model || 'text-embedding-3-small';
    this.baseUrl = 'https://api.openai.com/v1';

    if (!this.apiKey) {
      throw new Error('OpenAI API key required for embeddings');
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding failed: ${error}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }

  async embedSingle(text: string): Promise<number[]> {
    const embeddings = await this.embed([text]);
    return embeddings[0];
  }
}
