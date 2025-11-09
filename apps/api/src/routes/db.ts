import { Router, type Router as RouterType } from "express";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
let prisma: InstanceType<typeof PrismaClient> | null = null;
const db = (): InstanceType<typeof PrismaClient> => (prisma ??= new PrismaClient());

const router: RouterType = Router();

router.get("/health", async (_req, res) => {
  try {
    await db().$queryRaw`SELECT 1`;
    return res.json({ ok: true });
  } catch (error) {
    const msg = (error as any)?.message ?? String(error);
    console.error("DB health check failed:", msg);
    return res.status(503).json({ ok: false, error: "db_unavailable" });
  }
});

export default router;
