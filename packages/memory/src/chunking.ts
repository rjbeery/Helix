/**
 * Utilities for chunking documents for RAG
 */

export interface ChunkOptions {
  maxChunkSize?: number;
  overlap?: number;
  preserveParagraphs?: boolean;
}

/**
 * Split text into chunks with optional overlap
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const {
    maxChunkSize = 1000,
    overlap = 200,
    preserveParagraphs = true,
  } = options;

  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];

  if (preserveParagraphs) {
    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          // Add overlap from end of previous chunk
          const words = currentChunk.split(/\s+/);
          const overlapWords = words.slice(-Math.floor(overlap / 5));
          currentChunk = overlapWords.join(' ') + ' ';
        }
      }
      currentChunk += paragraph + '\n\n';
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
  } else {
    // Simple word-based chunking
    const words = text.split(/\s+/);
    let i = 0;

    while (i < words.length) {
      const chunkWords: string[] = [];
      let chunkLength = 0;

      while (i < words.length && chunkLength < maxChunkSize) {
        chunkWords.push(words[i]);
        chunkLength += words[i].length + 1; // +1 for space
        i++;
      }

      chunks.push(chunkWords.join(' '));

      // Add overlap
      if (i < words.length) {
        const overlapWordCount = Math.floor(overlap / 5);
        i -= overlapWordCount;
      }
    }
  }

  return chunks;
}

/**
 * Generate unique IDs for chunks
 */
export function generateChunkId(documentId: string, chunkIndex: number): string {
  return `${documentId}_chunk_${chunkIndex}`;
}
