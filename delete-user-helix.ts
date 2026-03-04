import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUserHelix() {
  try {
    console.log('\n=== Deleting Personal Helix Persona ===\n');

    const user = await prisma.user.findUnique({ 
      where: { email: 'rjbeery@gmail.com' },
      select: { id: true }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    const deleted = await prisma.persona.deleteMany({
      where: {
        userId: user.id,
        label: 'Helix',
        isGlobal: false
      }
    });

    console.log(`✅ Deleted ${deleted.count} personal Helix persona(s)\n`);
    console.log('Global Helix system personality remains (available to all users)\n');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUserHelix();
