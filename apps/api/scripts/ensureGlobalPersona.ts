import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

(async () => {
  const prisma: any = new PrismaClient();
  try {
    const engineId = process.env.DEFAULT_ENGINE_ID || "gpt-4o-mini";
    const label = process.env.GLOBAL_PERSONA_LABEL || "Helix";
    const specialization = process.env.GLOBAL_PERSONA_SPECIALIZATION || "Core Intelligence";
    const systemPrompt = process.env.GLOBAL_PERSONA_PROMPT ||
      "You are Helix, the central intelligence of the Helix AI system. You coordinate reasoning, memory, and collaboration between agents. Your tone is clear, calm, and precise. Prioritize accuracy, efficiency, and clarity.";
    const temperature = Number(process.env.GLOBAL_PERSONA_TEMPERATURE ?? 0.7);
    const maxTokens = Number(process.env.GLOBAL_PERSONA_MAX_TOKENS ?? 2000);
  const avatarUrl = process.env.GLOBAL_PERSONA_AVATAR_URL || "/images/Helix.png";

    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine || !engine.enabled) {
      throw new Error(`Engine ${engineId} not found or disabled`);
    }

    const existing = await prisma.persona.findFirst({ where: { isGlobal: true, label } });
    if (existing) {
      const updated = await prisma.persona.update({
        where: { id: existing.id },
        data: { engineId, specialization, systemPrompt, temperature, maxTokens, avatarUrl }
      });
      console.log("Global persona updated:", { id: updated.id, label: updated.label, engine: engine.displayName });
    } else {
      const created = await prisma.persona.create({
        data: {
          isGlobal: true,
          userId: null,
          engineId,
          label,
          specialization,
          systemPrompt,
          temperature,
          maxTokens,
          avatarUrl
        }
      });
      console.log("Global persona created:", { id: created.id, label: created.label, engine: engine.displayName });
    }
  } catch (err: any) {
    console.error("ensureGlobalPersona error:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
