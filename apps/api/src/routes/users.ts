import { Router, type Router as RouterType, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router: RouterType = Router();
let prisma: PrismaClient | null = null;
const db = (): InstanceType<typeof PrismaClient> => (prisma ??= new PrismaClient());
const MAX_PER_Q_CENTS = parseInt(process.env.MAX_PER_Q_CENTS || '500', 10); // hard cap safeguard

interface AuthedRequest extends Request {
  user?: { sub: string; role: string };
}

// PATCH /users/:id - Update user settings
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).user?.sub;
    const targetUserId = req.params.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Users can only edit their own settings (unless they're admin)
  const requestingUser = await db().user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!requestingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

  if (userId !== targetUserId && requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { budgetCents, maxBudgetPerQuestion, maxBatonPasses, truthinessThreshold } = req.body;

    // Enforce: Only admins can modify budget-related fields
    if (requestingUser.role !== 'admin' && (budgetCents !== undefined || maxBudgetPerQuestion !== undefined)) {
      return res.status(403).json({ error: 'Only admin can modify budget settings' });
    }

    // Validate inputs
    const updates: any = {};
    if (budgetCents !== undefined) {
      if (typeof budgetCents !== 'number' || budgetCents < 0) {
        return res.status(400).json({ error: 'Invalid budgetCents' });
      }
      updates.budgetCents = budgetCents;
    }
    if (maxBudgetPerQuestion !== undefined) {
      if (typeof maxBudgetPerQuestion !== 'number' || maxBudgetPerQuestion < 0) {
        return res.status(400).json({ error: 'Invalid maxBudgetPerQuestion' });
      }
      if (maxBudgetPerQuestion > MAX_PER_Q_CENTS) {
        return res.status(400).json({ error: `maxBudgetPerQuestion cannot exceed hard cap of ${MAX_PER_Q_CENTS} cents` });
      }
      updates.maxBudgetPerQuestion = maxBudgetPerQuestion;
    }
    if (maxBatonPasses !== undefined) {
      if (typeof maxBatonPasses !== 'number' || maxBatonPasses < 1 || maxBatonPasses > 20) {
        return res.status(400).json({ error: 'Invalid maxBatonPasses (must be 1-20)' });
      }
      updates.maxBatonPasses = maxBatonPasses;
    }
    if (truthinessThreshold !== undefined) {
      if (typeof truthinessThreshold !== 'number' || truthinessThreshold < 0 || truthinessThreshold > 1) {
        return res.status(400).json({ error: 'Invalid truthinessThreshold (must be 0-1)' });
      }
      updates.truthinessThreshold = truthinessThreshold;
    }

    // Update user
  const updatedUserAll = await db().user.update({
      where: { id: targetUserId },
      data: updates
    });

  const refreshed = await db().user.findUnique({
      where: { id: targetUserId },
      // Cast select as any to avoid Prisma type drift issues in dev
      select: ({
        budgetCents: true,
        maxBudgetPerQuestion: true,
        maxBatonPasses: true,
        truthinessThreshold: true
      } as any)
    });

    return res.json(refreshed);
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;
