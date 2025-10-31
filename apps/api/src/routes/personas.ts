import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Extend Express Request
interface AuthedRequest extends Request {
  user?: {
    sub: string;
    role: string;
  };
}

// GET /api/personas - List all personas
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const personas = await prisma.persona.findMany({
      where: { userId },
      include: {
        engine: true,
        _count: { select: { agents: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ personas });
  } catch (error) {
    console.error('Error fetching personas:', error);
    return res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

// POST /api/personas - Create persona
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { engineId, label, systemPrompt, avatarUrl, temperature, maxTokens } = req.body;

    if (!engineId || !label || !systemPrompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const persona = await prisma.persona.create({
      data: {
        userId,
        engineId,
        label,
        systemPrompt,
        avatarUrl: avatarUrl || null,
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 2000
      },
      include: { engine: true }
    });

    return res.status(201).json({ persona });
  } catch (error) {
    console.error('Error creating persona:', error);
    return res.status(500).json({ error: 'Failed to create persona' });
  }
});

export default router;
