import "dotenv/config";
import bcrypt from "bcryptjs";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

/*
Usage:
  pnpm --filter ./apps/api exec tsx scripts/ensureUser.ts <email> <password> [--engine <engineId>]

Environment fallbacks (optional):
  USER_EMAIL / USER_PASSWORD
  DEFAULT_ENGINE_ID (defaults to gpt-4o-mini)

Creates/updates a user with role 'user' and ensures a Helix persona if no global Helix exists
and the user doesn't already have one.
*/

(async () => {
  const prisma = new PrismaClient();
  try {
    // Parse CLI args
    const args = process.argv.slice(2);
    let email = args[0] || process.env.USER_EMAIL;
    let pass = args[1] || process.env.USER_PASSWORD;

    const engineFlagIdx = args.indexOf("--engine");
    const overrideEngine = engineFlagIdx !== -1 ? args[engineFlagIdx + 1] : undefined;

    if (!email || !pass) {
      console.error("Usage: tsx scripts/ensureUser.ts <email> <password> [--engine <engineId>]");
      throw new Error("Missing email or password");
    }

    if (pass.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const hash = await bcrypt.hash(pass, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hash, role: "user" },
      create: { email, passwordHash: hash, role: "user", budgetCents: 1500 },
    });
    console.log("User ensured:", email);

    const engineId = overrideEngine || process.env.DEFAULT_ENGINE_ID || "gpt-4o-mini";
    const label = "Helix";
    const specialization = "Core Intelligence";
    const systemPrompt = process.env.DEFAULT_PERSONA_PROMPT ||
      "You are Helix, the central intelligence of the Helix AI system. You coordinate reasoning, memory, and collaboration between agents. Your tone is clear, calm, and precise. Prioritize accuracy, efficiency, and clarity. When users ask questions, respond directly, explain reasoning simply, and suggest when a specialized agent might assist.";
    const temperature = 0.7;
    const maxTokens = 2000;
    const avatarUrl = "https://helixai.live/avatars/1762720388357-0avqu.png";

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
  } catch (err: any) {
    console.error("ensureUser error:", err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
