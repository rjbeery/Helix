// apps/api/scripts/ensureAdmin.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

(async () => {
  const prisma = new PrismaClient();
  try {
    const email = process.env.ADMIN_EMAIL;
    const pass  = process.env.ADMIN_PASSWORD;
    if (!email || !pass) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");

    const hash = await bcrypt.hash(pass, 10);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hash, role: "master" },
      create: { email, passwordHash: hash, role: "master", budgetCents: 10_000 },
    });
    console.log("Admin ensured:", email);
  } finally {
    await prisma.$disconnect();
  }
})();
