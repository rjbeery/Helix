#!/usr/bin/env tsx
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const curatedEngines = [
  {
    id: 'gpt-5.3',
    provider: 'openai',
    displayName: 'ChatGPT',
    enabled: true,
    costPer1MInput: 3000,
    costPer1MOutput: 12000,
  },
  {
    id: 'gemini-1.5-pro',
    provider: 'gemini',
    displayName: 'Gemini',
    enabled: true,
    costPer1MInput: 350,
    costPer1MOutput: 1050,
  },
  {
    id: 'grok-2',
    provider: 'grok',
    displayName: 'Grok',
    enabled: true,
    costPer1MInput: 500,
    costPer1MOutput: 1500,
  },
  {
    id: 'claude-3.5-opus',
    provider: 'anthropic',
    displayName: 'Claude',
    enabled: true,
    costPer1MInput: 1500,
    costPer1MOutput: 7500,
  },
] as const;

async function main() {
  console.log('Simplifying engine catalog...');

  for (const engine of curatedEngines) {
    await prisma.engine.upsert({
      where: { id: engine.id },
      create: engine,
      update: engine,
    });
    console.log(`  ✓ Enabled: ${engine.displayName} (${engine.id})`);
  }

  const keepIds = curatedEngines.map((engine) => engine.id);
  const disabled = await prisma.engine.updateMany({
    where: { id: { notIn: keepIds } },
    data: { enabled: false },
  });

  console.log(`  ✓ Disabled ${disabled.count} non-curated engines`);
  console.log('Done.');
}

main()
  .catch((error) => {
    console.error('Failed to simplify engines:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
