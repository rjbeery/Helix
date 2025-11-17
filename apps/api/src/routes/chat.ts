import { Router, Request, Response, type Router as RouterType } from 'express';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { createEngine, calculateCost } from '@helix/engines';
import type { Message } from '@helix/core';
import { RubricScores, scoreOf, DELTA_GAIN } from '@helix/utils';
import { createVectorStore } from '@helix/memory';

const router: RouterType = Router();
let prisma: InstanceType<typeof PrismaClient> | null = null;
const db = (): InstanceType<typeof PrismaClient> => (prisma ??= new PrismaClient());

// Lazy-load vector store for RAG
let vectorStore: ReturnType<typeof createVectorStore> | null = null;
function getVectorStore() {
  if (!vectorStore) {
    // Detect which backend to use from environment
    const storeType = (process.env.VECTOR_STORE_TYPE || 'pinecone') as 'pinecone' | 'postgres';
    
    // Only initialize if appropriate credentials are available
    const hasPinecone = process.env.PINECONE_API_KEY;
    const hasPostgres = process.env.DATABASE_URL;
    
    if ((storeType === 'pinecone' && !hasPinecone) || (storeType === 'postgres' && !hasPostgres)) {
      return null;
    }
    
    vectorStore = createVectorStore({
      storeType,
      // Pinecone config
      pineconeApiKey: process.env.PINECONE_API_KEY,
      pineconeIndexName: process.env.PINECONE_INDEX_NAME || 'helix-knowledge',
      pineconeNamespace: process.env.PINECONE_NAMESPACE || 'default',
      // Postgres config
      postgresConnectionString: process.env.DATABASE_URL,
      postgresTableName: 'embeddings',
      // Common config
      openaiApiKey: process.env.OPENAI_API_KEY,
      embeddingModel: 'text-embedding-3-small',
    });
  }
  return vectorStore;
}

type UserBudget = { budgetCents: number; maxBudgetPerQuestion: number };
type UserLimits = { budgetCents: number; maxBudgetPerQuestion: number; maxBatonPasses: number; truthinessThreshold: number };

interface AuthedRequest extends Request {
  user?: { sub: string; role: string };
}

/**
 * Evaluates an answer against the rubric using an LLM.
 * Returns a truthiness score from 0 to 1.
 */
async function evaluateTruthiness(
  engine: any,
  originalQuestion: string,
  answer: string
): Promise<{ score: number; rubric: RubricScores }> {
  const evaluationPrompt = `You are an answer quality evaluator. Evaluate the following answer against these criteria:

Original Question: ${originalQuestion}

Answer: ${answer}

Rate each dimension from 0 to 1 (use decimals like 0.7, 0.85):
1. Relevance (0-1): How well does the answer address the actual question?
2. Correctness (0-1): Is the answer factually accurate and logically sound?
3. Completeness (0-1): Does it cover all necessary details?
4. Clarity (0-1): Is it clear and understandable?
5. Brevity (0-1): Is it appropriately concise? (1 = perfectly concise, 0 = too verbose)

Respond ONLY with a JSON object in this exact format:
{
  "relevance": 0.X,
  "correctness": 0.X,
  "completeness": 0.X,
  "clarity": 0.X,
  "brevity": 0.X
}`;

  try {
    const response = await engine.complete({
      messages: [
        { role: 'system', content: 'You are a precise answer quality evaluator. Always respond with valid JSON only.' },
        { role: 'user', content: evaluationPrompt }
      ],
      temperature: 0.1, // Low temperature for consistent evaluation
      max_tokens: 200
    });

    // Extract JSON from response
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Failed to extract JSON from evaluation response:', response.text);
      // Return neutral scores as fallback
      return {
        score: 0.70,
        rubric: { relevance: 0.7, correctness: 0.7, completeness: 0.7, clarity: 0.7, brevity: 0.7 }
      };
    }

    const rubric: RubricScores = JSON.parse(jsonMatch[0]);
    const score = scoreOf(rubric);
    
    return { score, rubric };
  } catch (error) {
    console.error('Error evaluating truthiness:', error);
    // Return neutral scores on error
    return {
      score: 0.70,
      rubric: { relevance: 0.7, correctness: 0.7, completeness: 0.7, clarity: 0.7, brevity: 0.7 }
    };
  }
}

// POST /api/chat - Send message, get completion
router.post('/', async (req: Request, res: Response) => {
  try {
    const reqUser = (req as AuthedRequest).user;
    const userId = reqUser?.sub;
    const isAdmin = reqUser?.role === 'admin';
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { personaId, message, conversationId } = req.body;
    if (!personaId || !message) {
      return res.status(400).json({ error: 'Missing personaId or message' });
    }

    // Optional RAG flag (default false for backward compatibility)
    const useRag = req.body.useRag === true;

    // Load persona (allow admin any; user may use own or global)
  const persona = await db().persona.findFirst({
      where: isAdmin ? { id: personaId } : { id: personaId, OR: [{ userId }, { isGlobal: true }] },
      include: { 
        engine: true
      }
    });

    if (!persona) return res.status(404).json({ error: 'Persona not found' });
    if (!persona.engine.enabled) return res.status(400).json({ error: 'Engine disabled' });

    // Check budget
  const userBudget = await db().user.findUnique({
      where: { id: userId },
      select: { budgetCents: true, maxBudgetPerQuestion: true }
    }) as (UserBudget | null);

    if (!userBudget || userBudget.budgetCents <= 0) {
      return res.status(402).json({ error: 'Insufficient budget' });
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
  conversation = await db().conversation.findFirst({
        where: { id: conversationId, personaId: persona.id },
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 20 }
        }
      });
    }

    if (!conversation) {
  conversation = await db().conversation.create({
        data: { personaId: persona.id },
        include: { messages: true }
      });
    }

    // Build message history
    const messages: Message[] = [
      { role: 'system', content: persona.systemPrompt }
    ];

    for (const msg of conversation.messages) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      });
    }

    messages.push({ role: 'user', content: message });

    // Retrieve RAG context if enabled
    let ragContext: string | undefined;
    if (useRag) {
      try {
        const store = getVectorStore();
        if (store) {
          const results = await store.query(message, 3, { userId });
          if (results.length > 0) {
            ragContext = results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n');
          }
        }
      } catch (ragError) {
        console.warn('RAG retrieval failed, continuing without context:', ragError);
      }
    }

    // Inject RAG context into the last user message if available
    if (ragContext) {
      const lastIdx = messages.length - 1;
      messages[lastIdx] = {
        role: 'user',
        content: `Context from knowledge base:\n${ragContext}\n\nUser question: ${message}`
      };
    }

    // Get API key
    const provider = persona.engine.provider.toUpperCase();
    const apiKeyEnvVar = provider + '_API_KEY';
    const apiKey = process.env[apiKeyEnvVar];
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured for ' + persona.engine.provider });
    }

    // Call engine
    const engine = createEngine(persona.engineId as any, { apiKey });
    const startTime = Date.now();
    const response = await engine.complete({
      messages,
      temperature: persona.temperature ?? 0.7,
      max_tokens: persona.maxTokens ?? 2000
    });
    const latencyMs = Date.now() - startTime;

    // Calculate cost
    const costCents = response.usage ? calculateCost(
      persona.engineId as any,
      response.usage.prompt_tokens,
      response.usage.completion_tokens
    ) : 0;

    // Check max budget per question
    if (costCents > userBudget.maxBudgetPerQuestion) {
      return res.status(402).json({ 
        error: `Question cost (${costCents} cents) exceeds max budget per question (${userBudget.maxBudgetPerQuestion} cents)` 
      });
    }

    // Save messages
  await db().message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
        costCents: 0
      }
    });

  await db().message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: response.text,
        costCents
      }
    });

    // Deduct budget
  await db().user.update({
      where: { id: userId },
      data: { budgetCents: { decrement: costCents } }
    });

    return res.json({
      conversationId: conversation.id,
      message: response.text,
      usage: response.usage,
      costCents,
      remainingBudgetCents: userBudget.budgetCents - costCents,
      latencyMs
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Chat request failed', detail: error?.message || String(error) });
  }
});

// POST /api/chat/baton - Baton mode: sequential refinement
router.post('/baton', async (req: Request, res: Response) => {
  try {
    const reqUser = (req as AuthedRequest).user;
    const userId = reqUser?.sub;
    const isAdmin = reqUser?.role === 'admin';
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { personaIds, message, conversationIds } = req.body;
    if (!personaIds || !Array.isArray(personaIds) || personaIds.length === 0 || !message) {
      return res.status(400).json({ error: 'Missing personaIds or message' });
    }

    // Check budget
    const userLimits = await db().user.findUnique({
      where: { id: userId },
      select: { 
        budgetCents: true, 
        maxBudgetPerQuestion: true, 
        maxBatonPasses: true,
        truthinessThreshold: true
      }
    }) as (UserLimits | null);

    if (!userLimits || userLimits.budgetCents <= 0) {
      return res.status(402).json({ error: 'Insufficient budget' });
    }

    // Check max baton passes
    if (personaIds.length > userLimits.maxBatonPasses) {
      return res.status(400).json({ 
        error: `Too many personas in baton chain (${personaIds.length}). Maximum allowed: ${userLimits.maxBatonPasses}` 
      });
    }

    // Load all personas (allow own or global for users)
    const personas = await db().persona.findMany({
      where: isAdmin ? { id: { in: personaIds } } : { id: { in: personaIds }, OR: [{ userId }, { isGlobal: true }] },
      include: { engine: true }
    });

    if (personas.length !== personaIds.length) {
      return res.status(404).json({ error: 'One or more personas not found' });
    }

    // Sort personas by the order in personaIds
    const sortedPersonas = personaIds.map((id) => personas.find((p: any) => p.id === id)!);

    const batonChain: Array<{
      personaId: string;
      content: string;
      action: 'initial' | 'approved' | 'revised';
    }> = [];
    
    let currentAnswer = '';
    let totalCostCents = 0;
    const resultConversationIds: (string | null)[] = [];
    let metTruthiness = false;

    // Process each persona in sequence
    for (let i = 0; i < sortedPersonas.length; i++) {
      const persona = sortedPersonas[i];
      const convId = conversationIds?.[i] || null;

      // Get or create conversation
      let conversation;
      if (convId) {
        conversation = await db().conversation.findFirst({
          where: { id: convId, personaId: persona.id },
          include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } }
        });
      }

      if (!conversation) {
        conversation = await db().conversation.create({
          data: { personaId: persona.id },
          include: { messages: true }
        });
      }

      resultConversationIds.push(conversation.id);

      // Build message history
      const messages: Message[] = [
        { role: 'system', content: persona.systemPrompt }
      ];

      // Add conversation history
      for (const msg of conversation.messages) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        });
      }

      // First persona: respond to original question
      if (i === 0) {
        messages.push({ role: 'user', content: message });
      } else {
        // Subsequent personas: review previous answer
        const reviewPrompt = `Original question: ${message}\n\nPrevious answer:\n${currentAnswer}\n\nReview this answer. If it's good, respond with "APPROVE: [reason]". If you have a significantly better or clearer version, respond with "REVISE:" followed by your improved answer.`;
        messages.push({ role: 'user', content: reviewPrompt });
      }

      // Get API key
      const provider = persona.engine.provider.toUpperCase();
      const apiKeyEnvVar = provider + '_API_KEY';
      const apiKey = process.env[apiKeyEnvVar];
      if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured for ' + persona.engine.provider });
      }

      // Call engine
      const engine = createEngine(persona.engineId as any, { apiKey });
      const startTime = Date.now();
      const response = await engine.complete({
        messages,
        temperature: persona.temperature ?? 0.7,
        max_tokens: persona.maxTokens ?? 2000
      });
      const latencyMs = Date.now() - startTime;

      // Calculate cost
      const costCents = response.usage ? calculateCost(
        persona.engineId as any,
        response.usage.prompt_tokens,
        response.usage.completion_tokens
      ) : 0;

      totalCostCents += costCents;

      // Check budget
      if (userLimits.budgetCents < totalCostCents) {
        return res.status(402).json({ error: 'Insufficient budget mid-baton' });
      }

      // Check max budget per question
      if (totalCostCents > userLimits.maxBudgetPerQuestion) {
        return res.status(402).json({ 
          error: `Total baton cost (${totalCostCents} cents) exceeds max budget per question (${userLimits.maxBudgetPerQuestion} cents). Stopping after ${i + 1} of ${sortedPersonas.length} personas.` 
        });
      }

      // Save messages
      await db().message.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: messages[messages.length - 1].content,
          costCents: 0
        }
      });

      await db().message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: response.text,
          costCents
        }
      });

      // Determine action
      let action: 'initial' | 'approved' | 'revised' = 'initial';
      let displayContent = response.text;

      if (i === 0) {
        action = 'initial';
        currentAnswer = response.text;
      } else {
        // Check if approved or revised
        if (response.text.startsWith('APPROVE:')) {
          action = 'approved';
          displayContent = response.text.replace(/^APPROVE:\s*/, '');
          // Keep current answer
        } else if (response.text.startsWith('REVISE:')) {
          action = 'revised';
          displayContent = response.text.replace(/^REVISE:\s*/, '');
          currentAnswer = displayContent; // Update answer
        } else {
          // If no prefix, treat as revised
          action = 'revised';
          currentAnswer = response.text;
        }
      }

      batonChain.push({
        personaId: persona.id,
        content: displayContent,
        action
      });

      // Evaluate truthiness after each response
      // If the answer is good enough, stop the chain early
      const evaluation = await evaluateTruthiness(engine, message, currentAnswer);
  const acceptanceThreshold = userLimits.truthinessThreshold + DELTA_GAIN;

      console.log(`Baton pass ${i + 1}: Truthiness score = ${evaluation.score.toFixed(3)} (threshold: ${acceptanceThreshold.toFixed(3)})`);
      console.log(`  Rubric: R=${evaluation.rubric.relevance.toFixed(2)} C=${evaluation.rubric.correctness.toFixed(2)} Co=${evaluation.rubric.completeness.toFixed(2)} Cl=${evaluation.rubric.clarity.toFixed(2)} B=${evaluation.rubric.brevity.toFixed(2)}`);

      // If score meets threshold, stop the chain
      if (evaluation.score >= acceptanceThreshold) {
        console.log(`Answer meets truthiness threshold. Stopping baton chain at pass ${i + 1} of ${sortedPersonas.length}.`);
        metTruthiness = true;
        break;
      }
    }

    // Deduct total budget
    await db().user.update({
      where: { id: userId },
      data: { budgetCents: { decrement: totalCostCents } }
    });

    return res.json({
      batonChain,
      conversationIds: resultConversationIds,
      totalCostCents,
      remainingBudgetCents: userLimits.budgetCents - totalCostCents,
      finalReason: metTruthiness ? 'truthiness' : (batonChain.length === sortedPersonas.length ? 'exhausted' : 'unknown')
    });

  } catch (error: any) {
    console.error('Baton chat error:', error);
    return res.status(500).json({ error: 'Baton chat failed', detail: error?.message || String(error) });
  }
});

export default router;
