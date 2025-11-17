import { Router, type Router as RouterType } from "express";
import { z } from "zod";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth.js";
import { createVectorStore, chunkText, generateChunkId } from "@helix/memory";
import type { VectorDocument } from "@helix/memory";
import { documentParser } from "../utils/documentParser.js";

const rag: RouterType = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.md', '.pdf', '.docx', '.tex', '.json', '.csv'];
    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed: ${allowedTypes.join(', ')}`));
    }
  }
});

// Initialize vector store (lazy load)
let vectorStore: ReturnType<typeof createVectorStore> | null = null;

function getVectorStore() {
  if (!vectorStore) {
    // Detect which backend to use from environment
    const storeType = (process.env.VECTOR_STORE_TYPE || 'pinecone') as 'pinecone' | 'postgres';
    
    vectorStore = createVectorStore({
      storeType,
      // Pinecone config
      pineconeApiKey: process.env.PINECONE_API_KEY,
      pineconeIndexName: process.env.PINECONE_INDEX_NAME || 'helix-knowledge',
      pineconeNamespace: process.env.PINECONE_NAMESPACE || 'default',
      // Postgres config (will use DATABASE_URL if available)
      postgresConnectionString: process.env.DATABASE_URL,
      postgresTableName: 'embeddings',
      // Common config
      openaiApiKey: process.env.OPENAI_API_KEY,
      embeddingModel: 'text-embedding-3-small',
    });
  }
  return vectorStore;
}

// Schema for ingesting documents
const IngestDocumentSchema = z.object({
  documentId: z.string(),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
  chunkSize: z.number().min(100).max(5000).optional(),
  overlap: z.number().min(0).max(500).optional(),
});

/**
 * POST /v1/rag/ingest
 * Ingest a document into the vector store
 */
rag.post("/ingest", requireAuth, async (req, res) => {
  try {
    const parsed = IngestDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error });
    }

    const { documentId, content, metadata, chunkSize, overlap } = parsed.data;
    const userId = (req as any).user?.sub;

    // Chunk the document
    const chunks = chunkText(content, {
      maxChunkSize: chunkSize || 1000,
      overlap: overlap || 200,
      preserveParagraphs: true,
    });

    // Create vector documents
    const vectorDocs: VectorDocument[] = chunks.map((chunk, index) => ({
      id: generateChunkId(documentId, index),
      content: chunk,
      metadata: {
        documentId,
        chunkIndex: index,
        totalChunks: chunks.length,
        userId,
        ...metadata,
      },
    }));

    // Upsert to vector store
    const store = getVectorStore();
    await store.upsert(vectorDocs);

    return res.json({
      ok: true,
      documentId,
      chunksIngested: chunks.length,
    });
  } catch (error) {
    console.error('RAG ingest error:', error);
    return res.status(500).json({ 
      error: 'Failed to ingest document',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /v1/rag/upload
 * Upload a file (PDF, DOCX, TXT, TEX, etc.) and ingest into vector store
 */
rag.post("/upload", requireAuth, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = (req as any).user?.sub;
    const documentId = req.body.documentId || file.originalname.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-');
    const chunkSize = parseInt(req.body.chunkSize) || 1000;
    const overlap = parseInt(req.body.overlap) || 200;
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

    // Parse file content
    const content = await documentParser.parseBuffer(file.buffer, file.originalname);

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Could not extract text from file" });
    }

    // Chunk the document
    const chunks = chunkText(content, {
      maxChunkSize: chunkSize,
      overlap: overlap,
      preserveParagraphs: true,
    });

    // Create vector documents
    const vectorDocs: VectorDocument[] = chunks.map((chunk, index) => ({
      id: generateChunkId(documentId, index),
      content: chunk,
      metadata: {
        documentId,
        chunkIndex: index,
        totalChunks: chunks.length,
        userId,
        filename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
        ...metadata,
      },
    }));

    // Upsert to vector store
    const store = getVectorStore();
    await store.upsert(vectorDocs);

    return res.json({
      ok: true,
      documentId,
      filename: file.originalname,
      chunksIngested: chunks.length,
      contentLength: content.length,
    });
  } catch (error) {
    console.error('RAG upload error:', error);
    return res.status(500).json({ 
      error: 'Failed to upload and ingest file',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Schema for querying documents
const QuerySchema = z.object({
  query: z.string().min(1),
  topK: z.number().min(1).max(20).optional(),
  filter: z.record(z.string(), z.any()).optional(),
});

/**
 * POST /v1/rag/query
 * Query the vector store for relevant documents
 */
rag.post("/query", requireAuth, async (req, res) => {
  try {
    const parsed = QuerySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error });
    }

    const { query, topK, filter } = parsed.data;
    const userId = (req as any).user?.sub;

    // Add user filter to only retrieve their documents (unless admin)
    const userRole = (req as any).user?.role;
    const searchFilter = userRole === 'admin' ? filter : {
      ...filter,
      userId,
    };

    const store = getVectorStore();
    const results = await store.query(query, topK || 5, searchFilter);

    return res.json({
      ok: true,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('RAG query error:', error);
    return res.status(500).json({ 
      error: 'Failed to query documents',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Schema for deleting documents
const DeleteSchema = z.object({
  documentId: z.string(),
});

/**
 * DELETE /v1/rag/document
 * Delete a document and all its chunks from the vector store
 */
rag.delete("/document", requireAuth, async (req, res) => {
  try {
    const parsed = DeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error });
    }

    const { documentId } = parsed.data;
    
    // Query to find all chunk IDs for this document
    const store = getVectorStore();
    const chunks = await store.query(documentId, 1000, { documentId });
    const chunkIds = chunks.map(c => c.id);

    if (chunkIds.length > 0) {
      await store.delete(chunkIds);
    }

    return res.json({
      ok: true,
      documentId,
      chunksDeleted: chunkIds.length,
    });
  } catch (error) {
    console.error('RAG delete error:', error);
    return res.status(500).json({ 
      error: 'Failed to delete document',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default rag;
