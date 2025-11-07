#!/usr/bin/env tsx
/**
 * Run database migrations against production
 * Usage: DATABASE_URL="postgresql://..." pnpm tsx scripts/migrate-prod.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Running Prisma migrations...');
  
  try {
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
      cwd: process.cwd(),
      env: { ...process.env }
    });
    
    console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log('✅ Migrations completed successfully');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    process.exit(1);
  }
}

main();
