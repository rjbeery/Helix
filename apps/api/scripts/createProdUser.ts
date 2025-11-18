import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/*
Create or update a user directly in PRODUCTION using Secrets Manager.

Usage:
  pnpm -C apps/api exec tsx scripts/createProdUser.ts <email> <password> [--engine <engineId>]

Notes:
  - Requires AWS credentials with read access to the secret (helixai-secrets) in us-east-1.
  - Does NOT log the password; only logs email and actions taken.
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
  const args = process.argv.slice(2);
  const email = args[0];
  const pass = args[1];
  const engineFlagIdx = args.indexOf('--engine');
  const overrideEngine = engineFlagIdx !== -1 ? args[engineFlagIdx + 1] : undefined;

  if (!email || !pass) {
    console.error('Usage: tsx scripts/createProdUser.ts <email> <password> [--engine <engineId>]');
    process.exit(1);
    return;
  }
  if (pass.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const dbUrl = await getProdDatabaseUrl();
  const prisma = new PrismaClient({ datasourceUrl: dbUrl as any });
  try {
    const hash = await bcrypt.hash(pass, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hash, role: 'user' },
      create: { email, passwordHash: hash, role: 'user', budgetCents: 1500 },
    });
    console.log('User ensured (prod):', email);

    // Ensure Helix persona only if no global exists and user lacks one
    const engineId = overrideEngine || process.env.DEFAULT_ENGINE_ID || 'gpt-4o-mini';
    const label = 'Helix';
    const specialization = 'Core Intelligence';
    const systemPrompt = process.env.DEFAULT_PERSONA_PROMPT ||
      'You are Helix, the central intelligence of the Helix AI system. You coordinate reasoning, memory, and collaboration between agents. Your tone is clear, calm, and precise. Prioritize accuracy, efficiency, and clarity.';
    const temperature = 0.7;
    const maxTokens = 2000;
    const avatarUrl = 'https://helixai.live/avatars/1762720388357-0avqu.png';

    const globalHelix = await prisma.persona.findFirst({ where: { isGlobal: true, label } });
    const existing = await prisma.persona.findFirst({ where: { userId: user.id, label } });
    if (!existing && !globalHelix) {
      const engine = await prisma.engine.findUnique({ where: { id: engineId } });
      if (!engine || !engine.enabled) {
        console.warn(`Engine ${engineId} not found or disabled; skipping persona creation for ${email}`);
      } else {
        const persona = await prisma.persona.create({
          data: { userId: user.id, engineId, label, specialization, systemPrompt, temperature, maxTokens, avatarUrl },
          include: { engine: true },
        });
        console.log('Helix persona created (prod):', { id: persona.id, user: email, engine: persona.engine.displayName });
      }
    } else if (existing) {
      console.log('Helix persona already exists for (prod):', email);
    } else if (globalHelix) {
      console.log('Global Helix persona exists; not creating per-user Helix for (prod):', email);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('createProdUser error:', e.message);
  process.exit(1);
});
