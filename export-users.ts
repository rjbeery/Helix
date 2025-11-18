import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const db = new PrismaClient();

async function exportUsers() {
  try {
    console.log('Exporting users from local database...');
    
    const users = await db.user.findMany();
    
    fs.writeFileSync('users-export.json', JSON.stringify(users, null, 2));
    console.log(`Exported ${users.length} users to users-export.json`);
    
    users.forEach(u => {
      console.log(`  - ${u.email} (${u.role})`);
    });
  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    await db.$disconnect();
  }
}

exportUsers();
