import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const db = new PrismaClient();

async function exportData() {
  try {
    console.log('Exporting local data...');
    
    const engines = await db.engine.findMany();
    const personas = await db.persona.findMany({
      include: {
        engine: true,
      },
    });
    
    const data = {
      engines,
      personas: personas.map(p => ({
        id: p.id,
        label: p.label,
        specialization: p.specialization,
        systemPrompt: p.systemPrompt,
        avatarUrl: p.avatarUrl,
        engineId: p.engineId,
        userId: p.userId,
      })),
    };
    
    fs.writeFileSync('local-data-export.json', JSON.stringify(data, null, 2));
    console.log('Data exported to local-data-export.json');
    console.log(`Engines: ${engines.length}`);
    console.log(`Personas: ${personas.length}`);
  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    await db.$disconnect();
  }
}

exportData();
