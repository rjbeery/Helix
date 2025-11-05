import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

(async () => {
  const prisma: any = new PrismaClient();
  try {
    const result = await prisma.persona.deleteMany({
      where: { label: { in: ["assistant", "Assistant"] } }
    });
    console.log(`Deleted ${result.count} persona(s) with label "assistant" or "Assistant"`);
  } catch (err: any) {
    console.error("deleteAssistantPersonas error:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
