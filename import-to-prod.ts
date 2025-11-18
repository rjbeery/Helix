import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const db = new PrismaClient();

async function importData() {
  try {
    const rawData = fs.readFileSync('local-data-export.json', 'utf-8');
    const data = JSON.parse(rawData);
    
    console.log('Importing data to production...');
    console.log(`Engines to import: ${data.engines.length}`);
    console.log(`Personas to import: ${data.personas.length}`);
    
    // Import engines
    for (const engine of data.engines) {
      await db.engine.upsert({
        where: { id: engine.id },
        update: {
          displayName: engine.displayName,
          provider: engine.provider,
          modelName: engine.modelName,
          isEnabled: engine.isEnabled,
          costPerMillionInputTokens: engine.costPerMillionInputTokens,
          costPerMillionOutputTokens: engine.costPerMillionOutputTokens,
        },
        create: engine,
      });
      console.log(`✓ Engine: ${engine.displayName}`);
    }
    
    // Import personas (update engineId and userId to match production)
    for (const persona of data.personas) {
      // Find the production user to assign personas to
      const user = await db.user.findFirst();
      if (!user) {
        console.error('No user found in production database');
        break;
      }
      
      await db.persona.upsert({
        where: { id: persona.id },
        update: {
          label: persona.label,
          specialization: persona.specialization,
          systemPrompt: persona.systemPrompt,
          avatarUrl: persona.avatarUrl,
          engineId: persona.engineId,
          userId: user.id,
        },
        create: {
          ...persona,
          userId: user.id,
        },
      });
      console.log(`✓ Persona: ${persona.label}`);
    }
    
    console.log('Import complete!');
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await db.$disconnect();
  }
}

importData();
