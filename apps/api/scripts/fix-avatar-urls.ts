#!/usr/bin/env tsx
/**
 * Fix persona avatar URLs to use the correct S3 bucket URL
 * 
 * This script migrates persona avatarUrl values from the old CloudFront-based format
 * (https://helixai.live/avatars/...) to the direct S3 bucket URL format
 * (https://helixai-avatars-helixai-live.s3.amazonaws.com/avatars/...)
 * 
 * Usage:
 *   pnpm tsx scripts/fix-avatar-urls.ts [--dry-run]
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_PREFIX = 'https://helixai.live/avatars/';
const NEW_PREFIX = 'https://helixai-avatars-helixai-live.s3.amazonaws.com/avatars/';

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('🔍 Scanning personas for avatar URLs to fix...\n');

  // Find all personas with avatars using the old format
  const personas = await prisma.persona.findMany({
    where: {
      avatarUrl: {
        startsWith: OLD_PREFIX
      }
    },
    select: {
      id: true,
      label: true,
      avatarUrl: true,
      userId: true,
      isGlobal: true
    }
  });

  if (personas.length === 0) {
    console.log('✅ No personas found with old avatar URL format.');
    return;
  }

  console.log(`Found ${personas.length} persona(s) with old avatar URLs:\n`);

  for (const persona of personas) {
    const oldUrl = persona.avatarUrl!;
    const newUrl = oldUrl.replace(OLD_PREFIX, NEW_PREFIX);
    
    console.log(`📝 ${persona.label} (ID: ${persona.id})`);
    console.log(`   Old: ${oldUrl}`);
    console.log(`   New: ${newUrl}`);
    
    if (!isDryRun) {
      await prisma.persona.update({
        where: { id: persona.id },
        data: { avatarUrl: newUrl }
      });
      console.log('   ✅ Updated');
    } else {
      console.log('   [DRY RUN - would update]');
    }
    console.log('');
  }

  if (isDryRun) {
    console.log('\n🔍 Dry run complete. Run without --dry-run to apply changes.');
  } else {
    console.log(`\n✅ Successfully updated ${personas.length} persona(s).`);
  }
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
