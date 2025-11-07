import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

(async () => {
  const prisma: any = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        budgetCents: true,
        maxBudgetPerQuestion: true,
        maxBatonPasses: true,
        truthinessThreshold: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!users.length) {
      console.log("No users found.");
      return;
    }

    console.log("Users (newest first):\n");
    for (const u of users) {
      const dollars = (u.budgetCents / 100).toFixed(2);
      const cap = (u.maxBudgetPerQuestion / 100).toFixed(2);
      console.log(
        `- ${u.email}  [${u.role}]  created: ${u.createdAt.toISOString()}\n  budget: $${dollars}  max/question: $${cap}  baton: ${u.maxBatonPasses}  truthiness: ${(u.truthinessThreshold*100).toFixed(0)}%\n  id: ${u.id}\n`
      );
    }
  } catch (err: any) {
    console.error("listUsers error:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
