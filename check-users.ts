import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    console.log('\n=== Production Database Users ===\n');
    users.forEach((user) => {
      console.log(`${user.email} | Role: ${user.role} | Created: ${user.createdAt}`);
    });

    const rjbUser = users.find((u) => u.email === 'rjbeery@gmail.com');
    if (rjbUser) {
      console.log(`\n✓ rjbeery@gmail.com found in DB`);
      console.log(`  Role: ${rjbUser.role}`);
      console.log(`  Created: ${rjbUser.createdAt}`);
    } else {
      console.log('\n✗ rjbeery@gmail.com NOT found in DB');
    }
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
