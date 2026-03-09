#!/usr/bin/env tsx
/**
 * Add Gemini engines to the production database
 * 
 * This script adds Google Gemini models to the engine table.
 * 
 * Usage:
 *   DATABASE_URL="postgresql://..." pnpm tsx scripts/add-gemini-engines.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const geminiEngines = [
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
  }
];

async function main() {
  console.log('Adding Gemini engines to database...\n');

  for (const engine of geminiEngines) {
    try {
      const result = await prisma.engine.upsert({
        where: { id: engine.id },
        update: engine,
        create: engine
      });
      console.log(`✓ ${result.displayName} (${result.id})`);
    } catch (error) {
      console.error(`✗ Failed to add ${engine.displayName}:`, error);
    }
  }

  console.log('\n✅ Gemini engines added successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
