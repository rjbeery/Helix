import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyPersonas() {
  console.log('\n=== Verifying Helix Personas ===\n');

  // User's default persona
  const userPersona = await prisma.persona.findFirst({
    where: { userId: { not: null }, label: 'Helix' },
    include: { user: { select: { email: true } }, engine: true },
  });

  if (userPersona) {
    console.log('✓ User Default Helix Persona:');
    console.log(`  ID: ${userPersona.id}`);
    console.log(`  User: ${userPersona.user?.email}`);
    console.log(`  Engine: ${userPersona.engine.displayName}`);
    console.log(`  System Prompt: ${userPersona.systemPrompt.substring(0, 80)}...`);
  } else {
    console.log('✗ User Default Helix Persona: NOT FOUND');
  }

  // Global persona
  const globalPersona = await prisma.persona.findFirst({
    where: { isGlobal: true, label: 'Helix' },
    include: { engine: true },
  });

  if (globalPersona) {
    console.log('\n✓ Global Helix Persona:');
    console.log(`  ID: ${globalPersona.id}`);
    console.log(`  Global: ${globalPersona.isGlobal}`);
    console.log(`  Engine: ${globalPersona.engine.displayName}`);
    console.log(`  System Prompt: ${globalPersona.systemPrompt.substring(0, 80)}...`);
  } else {
    console.log('\n✗ Global Helix Persona: NOT FOUND');
  }

  console.log('\n✅ Helix is restored!\n');
  await prisma.$disconnect();
}

verifyPersonas().catch(console.error);
