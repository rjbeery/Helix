import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

(async () => {
  const prisma: any = new PrismaClient();
  try {
    const email = process.env.TARGET_EMAIL;
    const engineId = process.env.ENGINE_ID || "gpt-3.5-turbo";
    const label = process.env.LABEL || "Assistant";
    const specialization = process.env.SPECIALIZATION || null;
    const systemPrompt = process.env.PROMPT || "You are a helpful assistant.";
    const temperature = process.env.TEMPERATURE ? Number(process.env.TEMPERATURE) : 0.7;
    const maxTokens = process.env.MAX_TOKENS ? Number(process.env.MAX_TOKENS) : 2000;

    if (!email) throw new Error("Set TARGET_EMAIL in env");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`User not found: ${email}`);

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

    console.log("Persona created:", { id: persona.id, user: email, engine: persona.engine.displayName, label: persona.label });
  } catch (err: any) {
    console.error("assignPersona error:", err.message);
    process.exit(1);
  } finally {
    await (prisma as any).$disconnect();
  }
})();
