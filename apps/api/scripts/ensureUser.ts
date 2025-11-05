import "dotenv/config";
import bcrypt from "bcryptjs";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

(async () => {
  const prisma: any = new PrismaClient();
  try {
    const email = process.env.FNBO_EMAIL;
    const pass = process.env.FNBO_PASSWORD;
    if (!email || !pass) throw new Error("Set FNBO_EMAIL and FNBO_PASSWORD");

    const hash = await bcrypt.hash(pass, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hash, role: "user" },
      create: { email, passwordHash: hash, role: "user", budgetCents: 1_500 },
    });
    console.log("User ensured:", email);

    // Ensure default Helix persona for this user IF a global doesn't already exist
    const engineId = process.env.DEFAULT_ENGINE_ID || "gpt-3.5-turbo";
    const label = "Helix";
    const specialization = "Core Intelligence";
    const systemPrompt = process.env.DEFAULT_PERSONA_PROMPT ||
      "You are Helix, the central intelligence of the Helix AI system. You coordinate reasoning, memory, and collaboration between agents. Your tone is clear, calm, and precise. Prioritize accuracy, efficiency, and clarity. When users ask questions, respond directly, explain reasoning simply, and suggest when a specialized agent might assist.";
    const temperature = 0.7;
    const maxTokens = 2000;
    const avatarUrl = "/uploads/avatars/Helix.png";

    // If there's a global Helix persona, don't create a per-user copy
    const globalHelix = await prisma.persona.findFirst({ where: { isGlobal: true, label } });
    const existing = await prisma.persona.findFirst({ where: { userId: user.id, label } });
    if (!existing && !globalHelix) {
      const engine = await prisma.engine.findUnique({ where: { id: engineId } });
      if (!engine || !engine.enabled) {
        console.warn(`Engine ${engineId} not found or disabled; skipping persona creation for ${email}`);
      } else {
        const persona = await prisma.persona.create({
          data: { userId: user.id, engineId, label, specialization, systemPrompt, temperature, maxTokens, avatarUrl },
          include: { engine: true }
        });
        console.log("Helix persona created:", { id: persona.id, user: email, engine: persona.engine.displayName });
      }
    } else if (existing) {
      console.log("Helix persona already exists for:", email);
    } else if (globalHelix) {
      console.log("Global Helix persona exists; not creating per-user Helix for:", email);
    }
  } finally {
    await prisma.$disconnect();
  }
})();
