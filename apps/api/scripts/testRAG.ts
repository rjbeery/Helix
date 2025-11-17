import 'dotenv/config';
import { createVectorStore, chunkText, generateChunkId } from '@helix/memory';

async function testRAG() {
  console.log('🧪 Testing RAG with PostgreSQL pgvector backend\n');

  // Initialize vector store
  console.log('1. Initializing vector store...');
  const vectorStore = createVectorStore({
    storeType: 'postgres',
    postgresConnectionString: process.env.DATABASE_URL,
    openaiApiKey: process.env.OPENAI_API_KEY,
  });
  console.log('✓ Vector store initialized\n');

  // Test document
  const testDoc = `
Helix is a GenAI orchestration platform built with TypeScript and Python.
It supports multiple AI providers including OpenAI, Anthropic, and AWS Bedrock.
The system uses a personality-based approach where each conversation can have custom system prompts.
Helix now includes RAG (Retrieval-Augmented Generation) capabilities with support for both Pinecone and PostgreSQL pgvector.
Users can ingest documents and retrieve relevant context during chat conversations.
`;

  // Chunk the document
  console.log('2. Chunking test document...');
  const chunks = chunkText(testDoc, { maxChunkSize: 200, overlap: 50 });
  console.log(`✓ Created ${chunks.length} chunks\n`);

  // Create vector documents
  const documents = chunks.map((chunk, i) => ({
    id: generateChunkId('test-doc-1', i),
    content: chunk.trim(),
    metadata: { 
      documentId: 'test-doc-1',
      source: 'test',
      chunkIndex: i 
    }
  }));

  // Upsert documents
  console.log('3. Upserting documents to vector store...');
  await vectorStore.upsert(documents);
  console.log('✓ Documents upserted\n');

  // Query for similar content
  console.log('4. Querying for similar content...');
  const query = "What AI providers does Helix support?";
  console.log(`   Query: "${query}"`);
  
  const results = await vectorStore.query(query, 3);
  console.log(`✓ Found ${results.length} results:\n`);

  results.forEach((result, i) => {
    console.log(`   Result ${i + 1} (score: ${result.score.toFixed(4)}):`);
    console.log(`   ${result.content.substring(0, 100)}...`);
    console.log(`   Metadata:`, result.metadata);
    console.log();
  });

  // Clean up
  console.log('5. Cleaning up test data...');
  const idsToDelete = documents.map(doc => doc.id);
  await vectorStore.delete(idsToDelete);
  console.log('✓ Test data deleted\n');

  console.log('✅ RAG test completed successfully!');
}

testRAG()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  });
