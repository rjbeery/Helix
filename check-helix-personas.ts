import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkHelixPersonas() {
  console.log('\n=== Helix Personas Overview ===\n');

  // User's personal Helix
  const userHelix = await prisma.persona.findFirst({
    where: { userId: (await prisma.user.findUnique({ where: { email: 'rjbeery@gmail.com' }, select: { id: true } }))?.id, label: 'Helix' },
    include: { engine: true, user: true },
  });

  console.log('👤 User\'s Personal Helix:');
  if (userHelix) {
    console.log(`  ID: ${userHelix.id}`);
    console.log(`  User: ${userHelix.user?.email}`);
    console.log(`  isGlobal: ${userHelix.isGlobal}`);
    console.log(`  Engine: ${userHelix.engine.displayName}\n`);
  } else {
    console.log('  NOT FOUND\n');
  }

  // Global Helix
  const globalHelix = await prisma.persona.findFirst({
    where: { isGlobal: true, label: 'Helix' },
    include: { engine: true },
  });

  console.log('🌍 Global System Helix:');
  if (globalHelix) {
    console.log(`  ID: ${globalHelix.id}`);
    console.log(`  isGlobal: ${globalHelix.isGlobal}`);
    console.log(`  userId: ${globalHelix.userId || 'null (system-wide)'}`);
    console.log(`  Engine: ${globalHelix.engine.displayName}\n`);
  } else {
    console.log('  NOT FOUND\n');
  }

  if (userHelix && globalHelix) {
    console.log('⚠️  Both exist - frontend likely shows both');
    console.log('\nOptions:');
    console.log('1. Keep both (system default + user override)');
    console.log('2. Delete global persona (user-only version)');
    console.log('3. Delete user persona (global-only version)');
  }

  await prisma.$disconnect();
}

checkHelixPersonas().catch(console.error);
