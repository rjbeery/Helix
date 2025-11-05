import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const engines = [
    {
      id: 'gpt-4',
      provider: 'openai',
      displayName: 'GPT-4',
      enabled: true,
      costPer1MInput: 3000,
      costPer1MOutput: 6000
    },
    {
      id: 'gpt-4-turbo',
      provider: 'openai',
      displayName: 'GPT-4 Turbo',
      enabled: true,
      costPer1MInput: 1000,
      costPer1MOutput: 3000
    },
    {
      id: 'gpt-3.5-turbo',
      provider: 'openai',
      displayName: 'GPT-3.5 Turbo',
      enabled: true,
      costPer1MInput: 50,
      costPer1MOutput: 150
    },
    {
      id: 'claude-3-opus',
      provider: 'anthropic',
      displayName: 'Claude 3 Opus',
      enabled: true,
      costPer1MInput: 1500,
      costPer1MOutput: 7500
    },
    {
      id: 'claude-3.5-sonnet',
      provider: 'anthropic',
      displayName: 'Claude 3.5 Sonnet',
      enabled: true,
      costPer1MInput: 300,
      costPer1MOutput: 1500
    },
    {
      id: 'claude-3-sonnet',
      provider: 'anthropic',
      displayName: 'Claude 3 Sonnet',
      enabled: true,
      costPer1MInput: 300,
      costPer1MOutput: 1500
    },
    {
      id: 'claude-3-haiku',
      provider: 'anthropic',
      displayName: 'Claude 3 Haiku',
      enabled: true,
      costPer1MInput: 25,
      costPer1MOutput: 125
    }
  ];

  for (const engine of engines) {
    await prisma.engine.upsert({
      where: { id: engine.id },
      update: engine,
      create: engine
    });
    console.log('  ✓ Seeded engine: ' + engine.displayName);
  }

  console.log('\nDatabase seeded successfully!');
  console.log('Total engines: ' + engines.length);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
