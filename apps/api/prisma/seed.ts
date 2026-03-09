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
      id: 'gpt-4o-mini',
      provider: 'openai',
      displayName: 'GPT-4o Mini',
      enabled: true,
      costPer1MInput: 15,
      costPer1MOutput: 60
    },
    {
      id: 'gpt-3.5-turbo',
      provider: 'openai',
      displayName: 'GPT-3.5 Turbo',
      enabled: false,
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
    },
    {
      id: 'gemini-1.5-pro',
      provider: 'gemini',
      displayName: 'Gemini 1.5 Pro',
      enabled: true,
      costPer1MInput: 350,
      costPer1MOutput: 1050
    },
    {
      id: 'gemini-1.5-flash',
      provider: 'gemini',
      displayName: 'Gemini 1.5 Flash',
      enabled: true,
      costPer1MInput: 7.5,
      costPer1MOutput: 30
    },
    {
      id: 'gemini-1.5-flash-8b',
      provider: 'gemini',
      displayName: 'Gemini 1.5 Flash 8B',
      enabled: true,
      costPer1MInput: 3.75,
      costPer1MOutput: 15
    },
    {
      id: 'gemini-2.0-flash-exp',
      provider: 'gemini',
      displayName: 'Gemini 2.0 Flash (Experimental)',
      enabled: true,
      costPer1MInput: 0,
      costPer1MOutput: 0
    },
    {
      id: 'claude-opus-4-6',
      provider: 'anthropic',
      displayName: 'Claude Opus 4.6',
      enabled: true,
      costPer1MInput: 1500,
      costPer1MOutput: 7500
    },
    {
      id: 'claude-sonnet-4-6',
      provider: 'anthropic',
      displayName: 'Claude Sonnet 4.6',
      enabled: true,
      costPer1MInput: 300,
      costPer1MOutput: 1500
    },
    {
      id: 'claude-haiku-4-5-20251001',
      provider: 'anthropic',
      displayName: 'Claude Haiku 4.5',
      enabled: true,
      costPer1MInput: 25,
      costPer1MOutput: 125
    },
    {
      id: 'gpt-4o',
      provider: 'openai',
      displayName: 'GPT-4o',
      enabled: true,
      costPer1MInput: 500,
      costPer1MOutput: 1500
    },
    {
      id: 'grok-2',
      provider: 'grok',
      displayName: 'Grok 2',
      enabled: true,
      costPer1MInput: 500,
      costPer1MOutput: 1500
    },
    {
      id: 'grok-2-latest',
      provider: 'grok',
      displayName: 'Grok 2 Latest',
      enabled: true,
      costPer1MInput: 500,
      costPer1MOutput: 1500
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
