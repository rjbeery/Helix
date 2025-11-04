import "dotenv/config";
import bcrypt from "bcryptjs";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

(async () => {
  const prisma = new PrismaClient();
  try {
    const email = process.env.FNBO_EMAIL;
    const pass = process.env.FNBO_PASSWORD;
    if (!email || !pass) throw new Error("Set FNBO_EMAIL and FNBO_PASSWORD");

    const hash = await bcrypt.hash(pass, 10);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hash, role: "user" },
      create: { email, passwordHash: hash, role: "user", budgetCents: 1_500 },
    });
    console.log("User ensured:", email);
  } finally {
    await prisma.$disconnect();
  }
})();
