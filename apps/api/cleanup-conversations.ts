import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('Deleting all messages...');
  await prisma.message.deleteMany({});
  
  console.log('Deleting all conversations...');
  await prisma.conversation.deleteMany({});
  
  console.log('Cleanup complete!');
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
