import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/*
Migrate from Claude 3 to Claude 4 engines in production.
- Disables all Claude 3 engines
- Adds Claude 4 engines (Opus, Sonnet, Haiku)

Usage:
  pnpm -C apps/api exec tsx scripts/migrateToClaude4.ts

Notes:
  - Requires AWS credentials with read access to the secret (helixai-secrets) in us-east-1.
*/

async function getProdDatabaseUrl(secretId = process.env.SECRETS_NAME || 'helixai-secrets'): Promise<string> {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!res.SecretString) throw new Error('SecretString is empty');
  const parsed = JSON.parse(res.SecretString);
  const url = parsed.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing in secret');
  return url;
}

async function main() {
  const dbUrl = await getProdDatabaseUrl();
  const prisma = new PrismaClient({ datasourceUrl: dbUrl as any });
  
  try {
    console.log('=== Migrating to Claude 4 Engines ===\n');

    // 1. Disable all Claude 3 engines
    console.log('Step 1: Disabling Claude 3 engines...');
    const claude3Models = [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-3-5-sonnet-20241022'
    ];

    for (const modelId of claude3Models) {
      const existing = await prisma.engine.findUnique({ where: { id: modelId } });
      if (existing) {
        await prisma.engine.update({
          where: { id: modelId },
          data: { enabled: false }
        });
        console.log(`  ✓ Disabled ${existing.displayName}`);
      }
    }

    // 2. Add Claude 4 engines
    console.log('\nStep 2: Adding Claude 4 engines...');
    
    const claude4Engines = [
      {
        id: 'claude-4-opus-20250514',
        displayName: 'Claude 4 Opus',
        provider: 'anthropic',
        costPer1MInput: 1500,
        costPer1MOutput: 7500,
        enabled: true
      },
      {
        id: 'claude-4-sonnet-20250514',
        displayName: 'Claude 4 Sonnet',
        provider: 'anthropic',
        costPer1MInput: 300,
        costPer1MOutput: 1500,
        enabled: true
      },
      {
        id: 'claude-4-haiku-20250514',
        displayName: 'Claude 4 Haiku',
        provider: 'anthropic',
        costPer1MInput: 25,
        costPer1MOutput: 125,
        enabled: true
      }
    ];

    for (const engine of claude4Engines) {
      const existing = await prisma.engine.findUnique({ where: { id: engine.id } });
      if (existing) {
        await prisma.engine.update({
          where: { id: engine.id },
          data: engine
        });
        console.log(`  ✓ Updated ${engine.displayName}`);
      } else {
        await prisma.engine.create({ data: engine });
        console.log(`  ✓ Created ${engine.displayName}`);
      }
    }

    // 3. Show final state
    console.log('\nStep 3: Final engine state...');
    const allClaude = await prisma.engine.findMany({
      where: {
        OR: [
          { id: { startsWith: 'claude-3' } },
          { id: { startsWith: 'claude-4' } }
        ]
      },
      orderBy: { id: 'asc' }
    });

    console.log('\nClaude Engines:');
    for (const engine of allClaude) {
      const status = engine.enabled ? '✓ enabled' : '✗ disabled';
      console.log(`  ${status} - ${engine.displayName} (${engine.id})`);
    }

    console.log('\n=== Migration Complete ===');

  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('migrateToClaude4 error:', e.message);
  process.exit(1);
});
