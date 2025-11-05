import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

(async () => {
  const prisma: any = new PrismaClient();
  try {
    const personas = await prisma.persona.findMany({
      select: { id: true, label: true, userId: true, isGlobal: true, avatarUrl: true },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    console.log("Recent personas:");
    console.table(personas);
  } catch (err: any) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
