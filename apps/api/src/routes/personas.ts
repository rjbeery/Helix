import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { upload, uploadToS3, getLocalAvatarUrl } from '../config/upload.js';

const router = Router();
const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';

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
        engine: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ personas });
  } catch (error) {
    console.error('Error fetching personas:', error);
    return res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

// GET /api/personas/engines - List available engines (must be before /:id routes)
router.get('/engines', async (req: Request, res: Response) => {
  try {
    const engines = await prisma.engine.findMany({
      where: { enabled: true },
      orderBy: { displayName: 'asc' }
    });

    return res.json({ engines });
  } catch (error) {
    console.error('Error fetching engines:', error);
    return res.status(500).json({ error: 'Failed to fetch engines' });
  }
});

// POST /api/personas - Create persona
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { engineId, label, specialization, systemPrompt, avatarUrl, temperature, maxTokens } = req.body;

    if (!engineId || !label || !systemPrompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const persona = await prisma.persona.create({
      data: {
        userId,
        engineId,
        label,
        specialization: specialization ?? null,
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

// POST /api/personas/:id/avatar - Upload avatar image
router.post('/:id/avatar', upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify ownership
    const existing = await prisma.persona.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    // Upload to S3 in production, use local path in development
    let avatarUrl: string;
    if (isProduction) {
      avatarUrl = await uploadToS3(file);
    } else {
      avatarUrl = getLocalAvatarUrl(file.filename!);
    }

    // Update persona with new avatar URL
    const persona = await prisma.persona.update({
      where: { id },
      data: { avatarUrl },
      include: { engine: true }
    });

    return res.json({ persona });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// PATCH /api/personas/:id - Update persona
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { engineId, label, specialization, systemPrompt, avatarUrl, temperature, maxTokens } = req.body;

    // Verify ownership
    const existing = await prisma.persona.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    const persona = await prisma.persona.update({
      where: { id },
      data: {
        ...(engineId !== undefined && { engineId }),
        ...(label !== undefined && { label }),
        ...(specialization !== undefined && { specialization }),
        ...(systemPrompt !== undefined && { systemPrompt }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(temperature !== undefined && { temperature }),
        ...(maxTokens !== undefined && { maxTokens })
      },
      include: { engine: true }
    });

    return res.json({ persona });
  } catch (error) {
    console.error('Error updating persona:', error);
    return res.status(500).json({ error: 'Failed to update persona' });
  }
});

export default router;
