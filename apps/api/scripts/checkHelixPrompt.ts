import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

(async () => {
  const prisma: any = new PrismaClient();
  try {
    const persona = await prisma.persona.findFirst({ where: { isGlobal: true } });
    console.log("Label:", persona.label);
    console.log("Engine ID:", persona.engineId);
    console.log("System Prompt:\n", persona.systemPrompt);
  } catch (err: any) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
