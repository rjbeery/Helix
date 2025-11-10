import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

interface PersonaInput {
  email: string;
  label: string;
  engineId: string;
  systemPrompt: string;
  specialization?: string | null;
  temperature?: number;
  maxTokens?: number;
  avatarUrl?: string | null;
}

function usage(): never {
  console.log(`\nBulk Import Personas\n\nUsage:\n  pnpm --filter ./apps/api exec tsx scripts/bulkImportPersonas.ts <path-to-json> [--createUsers] [--updateExisting]\n\nJSON format (array of objects):\n  [\n    {\n      "email": "user@example.com",\n      "label": "Helix",\n      "engineId": "gpt-3.5-turbo",\n      "systemPrompt": "...",\n      "specialization": "Core Intelligence",\n      "temperature": 0.7,\n      "maxTokens": 2000,\n      "avatarUrl": "https://helixai.live/avatars/1762720388357-0avqu.png"\n    }\n  ]\n`);
  process.exit(1);
}

(async () => {
  const prisma: any = new PrismaClient();
  try {
    const filePath = process.argv[2];
    const createUsers = process.argv.includes("--createUsers");
    const updateExisting = process.argv.includes("--updateExisting");

    if (!filePath) usage();

    const abs = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(abs)) {
      console.error("File not found:", abs);
      process.exit(1);
    }

    const raw = fs.readFileSync(abs, "utf-8");
    let items: PersonaInput[];
    try {
      items = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse JSON:", (e as Error).message);
      process.exit(1);
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      console.error("Input must be a non-empty JSON array");
      process.exit(1);
    }

    let created = 0, updated = 0, skipped = 0, usersMade = 0;

    for (const item of items) {
      const { email, label, engineId, systemPrompt } = item;
      if (!email || !label || !engineId || !systemPrompt) {
        console.warn("Skipping row with missing required fields:", item);
        skipped++;
        continue;
      }

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        if (!createUsers) {
          console.warn(`User not found (${email}); skipping (use --createUsers to auto-create)`);
          skipped++;
          continue;
        }
        const defaultPass = process.env.DEFAULT_BULK_USER_PASSWORD || "ChangeMe123!";
        const bcrypt = await import("bcryptjs");
        const hash = await bcrypt.default.hash(defaultPass, 10);
        user = await prisma.user.create({ data: { email, passwordHash: hash, role: "user", budgetCents: 1500 } });
        usersMade++;
      }

      const engine = await prisma.engine.findUnique({ where: { id: engineId } });
      if (!engine || !engine.enabled) {
        console.warn(`Engine not found or disabled: ${engineId}; skipping ${email}/${label}`);
        skipped++;
        continue;
      }

      const existing = await prisma.persona.findFirst({ where: { userId: user.id, label } });
      if (existing) {
        if (!updateExisting) {
          console.log(`Persona exists; skipping ${email}/${label}`);
          skipped++;
          continue;
        }
        await prisma.persona.update({
          where: { id: existing.id },
          data: {
            engineId,
            systemPrompt: item.systemPrompt,
            specialization: item.specialization ?? null,
            temperature: item.temperature ?? 0.7,
            maxTokens: item.maxTokens ?? 2000,
            avatarUrl: item.avatarUrl ?? existing.avatarUrl ?? null,
          }
        });
        updated++;
        continue;
      }

      await prisma.persona.create({
        data: {
          userId: user.id,
          engineId,
          label,
          systemPrompt: item.systemPrompt,
          specialization: item.specialization ?? null,
          temperature: item.temperature ?? 0.7,
          maxTokens: item.maxTokens ?? 2000,
          avatarUrl: item.avatarUrl ?? "https://helixai.live/avatars/1762720388357-0avqu.png",
        }
      });
      created++;
    }

    console.log("\nBulk import complete:");
    console.log({ created, updated, skipped, usersMade });
  } catch (err: any) {
    console.error("bulkImportPersonas error:", err.message);
    process.exit(1);
  } finally {
    await (prisma as any).$disconnect();
  }
})();
