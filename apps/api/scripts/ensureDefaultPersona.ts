import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

(async () => {
  const prisma: any = new PrismaClient();
  try {
    const email = process.env.ADMIN_EMAIL;
    if (!email) throw new Error("Set ADMIN_EMAIL in env");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`Admin user not found: ${email} (run scripts/ensureAdmin.ts)`);

    const engineId = process.env.DEFAULT_ENGINE_ID || "gpt-4o-mini";
  const label = process.env.DEFAULT_PERSONA_LABEL || "Helix";
  const systemPrompt = process.env.DEFAULT_PERSONA_PROMPT || "You are Helix, the central intelligence of the Helix AI system. You coordinate reasoning, memory, and collaboration between agents. Your tone is clear, calm, and precise. Prioritize accuracy, efficiency, and clarity. When users ask questions, respond directly, explain reasoning simply, and suggest when a specialized agent might assist.";
  const specialization = process.env.DEFAULT_PERSONA_SPECIALIZATION || "Core Intelligence";
    const temperature = process.env.DEFAULT_PERSONA_TEMPERATURE ? Number(process.env.DEFAULT_PERSONA_TEMPERATURE) : 0.7;
    const maxTokens = process.env.DEFAULT_PERSONA_MAX_TOKENS ? Number(process.env.DEFAULT_PERSONA_MAX_TOKENS) : 2000;

    // If a 'Helix' persona exists, skip; else if an older default 'Assistant' exists, rename/update it
    const existingHelix = await prisma.persona.findFirst({ where: { userId: user.id, label: label } });
    if (existingHelix) {
      console.log(`Persona already exists for ${email} with label '${label}':`, existingHelix.id);
      return;
    }
    const legacy = await prisma.persona.findFirst({ where: { userId: user.id, label: "Assistant" } });
    if (legacy) {
      const updated = await prisma.persona.update({
        where: { id: legacy.id },
        data: { label, specialization, systemPrompt, engineId },
        include: { engine: true }
      });
      console.log("Default persona renamed/updated:", { id: updated.id, user: email, engine: updated.engine.displayName, label: updated.label });
      return;
    }

    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine || !engine.enabled) throw new Error(`Engine not found or disabled: ${engineId}`);

    const persona = await prisma.persona.create({
      data: {
        userId: user.id,
        engineId,
        label,
        specialization,
        systemPrompt,
        temperature,
        maxTokens,
      },
      include: { engine: true }
    });

    console.log("Default persona created:", { id: persona.id, user: email, engine: persona.engine.displayName, label: persona.label });
  } catch (err: any) {
    console.error("ensureDefaultPersona error:", err.message);
    process.exit(1);
  } finally {
    await (prisma as any).$disconnect();
  }
})();
