import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDuplicates() {
  console.log('\n=== Checking for Duplicate Personas ===\n');

  const personas = await prisma.persona.findMany({
    where: { 
      user: { email: 'rjbeery@gmail.com' }
    },
    include: { engine: true, user: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Total personas for rjbeery@gmail.com: ${personas.length}\n`);

  personas.forEach((p, idx) => {
    console.log(`[${idx + 1}] ID: ${p.id}`);
    console.log(`    Label: ${p.label}`);
    console.log(`    Engine: ${p.engine.displayName}`);
    console.log(`    Created: ${p.createdAt}`);
    console.log('');
  });

  // Find duplicates by label
  const byLabel = new Map<string, typeof personas>();
  personas.forEach((p) => {
    if (!byLabel.has(p.label)) byLabel.set(p.label, []);
    byLabel.get(p.label)!.push(p);
  });

  console.log('=== Duplicates by Label ===\n');
  let hasDuplicates = false;
  byLabel.forEach((plist, label) => {
    if (plist.length > 1) {
      hasDuplicates = true;
      console.log(`❌ "${label}" appears ${plist.length} times`);
      plist.forEach((p, idx) => {
        console.log(`   [${idx + 1}] ${p.id} (created ${p.createdAt})`);
      });
      console.log('');
    }
  });

  if (!hasDuplicates) {
    console.log('✅ No duplicates found\n');
  }

  await prisma.$disconnect();
}

findDuplicates().catch(console.error);
