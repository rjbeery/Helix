import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

(async () => {
  const prisma: any = new PrismaClient();
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    const engineId = process.env.DEFAULT_ENGINE_ID || "gpt-3.5-turbo";
    const label = "Helix";
    const specialization = "Core Intelligence";
    const systemPrompt = process.env.DEFAULT_PERSONA_PROMPT ||
      "You are Helix, the central intelligence of the Helix AI system. You coordinate reasoning, memory, and collaboration between agents. Your tone is clear, calm, and precise. Prioritize accuracy, efficiency, and clarity. When users ask questions, respond directly, explain reasoning simply, and suggest when a specialized agent might assist.";
    const temperature = 0.7;
    const maxTokens = 2000;
    const avatarUrl = "/uploads/avatars/Helix.png";

    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine || !engine.enabled) throw new Error(`Engine not found or disabled: ${engineId}`);

    for (const u of users) {
      const existingHelix = await prisma.persona.findFirst({ where: { userId: u.id, label } });
      if (existingHelix) {
        continue;
      }
      const legacy = await prisma.persona.findFirst({ where: { userId: u.id, label: "Assistant" } });
      if (legacy) {
        await prisma.persona.update({
          where: { id: legacy.id },
          data: { label, specialization, systemPrompt, engineId, avatarUrl }
        });
        console.log(`Renamed/updated legacy Assistant -> Helix for ${u.email}`);
      } else {
        await prisma.persona.create({
          data: { userId: u.id, engineId, label, specialization, systemPrompt, temperature, maxTokens, avatarUrl }
        });
        console.log(`Created Helix persona for ${u.email}`);
      }
    }

    console.log("Done ensuring Helix persona for all users.");
  } catch (err: any) {
    console.error("ensureHelixForAllUsers error:", err.message);
    process.exit(1);
  } finally {
    await (prisma as any).$disconnect();
  }
})();
