import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.persona.updateMany({
    where: { label: { contains: 'Chris' } },
    data: { specialization: 'Bank Senior Director' }
  });
  
  console.log(`Updated ${result.count} persona(s)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
