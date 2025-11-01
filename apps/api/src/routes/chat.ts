import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createEngine, calculateCost } from '@helix/engines';
import type { Message } from '@helix/core';

const router = Router();
const prisma = new PrismaClient();

interface AuthedRequest extends Request {
  user?: { sub: string; role: string };
}

// POST /api/chat - Send message, get completion
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { personaId, message, conversationId } = req.body;
    if (!personaId || !message) {
      return res.status(400).json({ error: 'Missing personaId or message' });
    }

    // Load persona
    const persona = await prisma.persona.findFirst({
      where: { id: personaId, userId },
      include: { 
        engine: true
      }
    });

    if (!persona) return res.status(404).json({ error: 'Persona not found' });
    if (!persona.engine.enabled) return res.status(400).json({ error: 'Engine disabled' });

    // Check budget
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { budgetCents: true }
    });

    if (!user || user.budgetCents <= 0) {
      return res.status(402).json({ error: 'Insufficient budget' });
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, personaId: persona.id },
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 20 }
        }
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
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

    // Save messages
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
        costCents: 0
      }
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: response.text,
        costCents
      }
    });

    // Deduct budget
    await prisma.user.update({
      where: { id: userId },
      data: { budgetCents: { decrement: costCents } }
    });

    return res.json({
      conversationId: conversation.id,
      message: response.text,
      usage: response.usage,
      costCents,
      remainingBudgetCents: user.budgetCents - costCents,
      latencyMs
    });

  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Chat request failed' });
  }
});

export default router;
