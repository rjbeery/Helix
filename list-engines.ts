import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listEngines() {
  const engines = await prisma.engine.findMany({
    select: {
      id: true,
      displayName: true,
      provider: true,
      enabled: true,
    },
    orderBy: { displayName: 'asc' },
  });

  console.log('\n=== Available Engines ===\n');
  engines.forEach((e) => {
    const status = e.enabled ? '✓' : '✗';
    console.log(`${status} ${e.id.padEnd(20)} | ${e.displayName.padEnd(20)} | ${e.provider}`);
  });

  if (engines.length === 0) {
    console.log('No engines found. Run prisma/seed.ts to create them.');
  }

  await prisma.$disconnect();
}

listEngines().catch(console.error);
