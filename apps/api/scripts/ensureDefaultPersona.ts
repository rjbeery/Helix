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

    const engineId = process.env.DEFAULT_ENGINE_ID || "gpt-3.5-turbo";
    const label = process.env.DEFAULT_PERSONA_LABEL || "Assistant";
    const systemPrompt = process.env.DEFAULT_PERSONA_PROMPT || "You are a helpful, concise assistant.";
    const specialization = process.env.DEFAULT_PERSONA_SPECIALIZATION || null;
    const temperature = process.env.DEFAULT_PERSONA_TEMPERATURE ? Number(process.env.DEFAULT_PERSONA_TEMPERATURE) : 0.7;
    const maxTokens = process.env.DEFAULT_PERSONA_MAX_TOKENS ? Number(process.env.DEFAULT_PERSONA_MAX_TOKENS) : 2000;

    // Skip if a persona with same label already exists for this user
    const existing = await prisma.persona.findFirst({ where: { userId: user.id, label } });
    if (existing) {
      console.log(`Persona already exists for ${email} with label '${label}':`, existing.id);
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
