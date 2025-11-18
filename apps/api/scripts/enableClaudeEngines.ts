import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/*
Re-enable all Claude engines in production.

Usage:
  pnpm -C apps/api exec tsx scripts/enableClaudeEngines.ts

Notes:
  - Requires AWS credentials with read access to the secret (helixai-secrets) in us-east-1.
  - Will enable all engines with IDs starting with 'claude-'
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
    // Find all Claude engines
    const claudeEngines = await prisma.engine.findMany({
      where: {
        id: {
          startsWith: 'claude-'
        }
      }
    });

    console.log(`Found ${claudeEngines.length} Claude engines`);
    
    // Show current status
    for (const engine of claudeEngines) {
      console.log(`  ${engine.id}: enabled=${engine.enabled}`);
    }

    // Enable all Claude engines
    const result = await prisma.engine.updateMany({
      where: {
        id: {
          startsWith: 'claude-'
        }
      },
      data: {
        enabled: true
      }
    });

    console.log(`\nEnabled ${result.count} Claude engines in production`);

    // Verify
    const updated = await prisma.engine.findMany({
      where: {
        id: {
          startsWith: 'claude-'
        }
      },
      select: {
        id: true,
        displayName: true,
        enabled: true
      }
    });

    console.log('\nUpdated Claude engines:');
    for (const engine of updated) {
      console.log(`  ✓ ${engine.displayName} (${engine.id}): enabled=${engine.enabled}`);
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('enableClaudeEngines error:', e.message);
  process.exit(1);
});
