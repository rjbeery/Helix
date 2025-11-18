import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function fixLegacyAvatars() {
  try {
    console.log('Finding personas with legacy avatar URLs...');
    
    const legacyPersonas = await db.persona.findMany({
      where: {
        OR: [
          { avatarUrl: { contains: '/uploads/' } },
          { avatarUrl: { contains: '/images/' } },
          { avatarUrl: { startsWith: 'http://localhost' } }
        ]
      }
    });
    
    console.log(`Found ${legacyPersonas.length} personas with legacy avatars`);
    
    for (const persona of legacyPersonas) {
      console.log(`  - ${persona.label}: ${persona.avatarUrl} → null`);
      await db.persona.update({
        where: { id: persona.id },
        data: { avatarUrl: null }
      });
    }
    
    console.log('✓ Legacy avatars cleared');
  } catch (error) {
    console.error('Fix failed:', error);
  } finally {
    await db.$disconnect();
  }
}

fixLegacyAvatars();
