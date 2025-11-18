import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/*
Rename a production user (change email) and set a new password.

Usage:
  pnpm -C apps/api exec tsx scripts/renameProdUser.ts <oldEmail> <newEmail> <newPassword>

Notes:
  - Requires AWS credentials with read access to the secret (helixai-secrets) in us-east-1.
  - Will fail if another user already has <newEmail>.
  - Does NOT log the password.
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
  const [oldEmail, newEmail, newPassword] = process.argv.slice(2);
  if (!oldEmail || !newEmail || !newPassword) {
    console.error('Usage: tsx scripts/renameProdUser.ts <oldEmail> <newEmail> <newPassword>');
    process.exit(1);
    return;
  }
  if (newPassword.length < 8) throw new Error('Password must be at least 8 characters');

  const dbUrl = await getProdDatabaseUrl();
  const prisma = new PrismaClient({ datasourceUrl: dbUrl as any });
  try {
    const user = await prisma.user.findUnique({ where: { email: oldEmail } });
    if (!user) {
      console.error('User not found (oldEmail):', oldEmail);
      process.exit(2);
      return;
    }
    const existingNew = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingNew && existingNew.id !== user.id) {
      throw new Error(`Another user already has email ${newEmail}`);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { email: newEmail, passwordHash: hash },
    });

    console.log('User renamed (prod):', { id: updated.id, from: oldEmail, to: newEmail });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('renameProdUser error:', e.message);
  process.exit(1);
});
