import { Router } from "express";
import * as bcrypt from "bcryptjs";
import * as jwtRaw from "jsonwebtoken";
const jwt = (jwtRaw as any).default ?? (jwtRaw as any);
import pkg from "@prisma/client";
import { z } from "zod";
import type { Role } from "../types/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const auth = Router();
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

const AdminResetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8),
});
auth.post("/login", async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('Validation error:', parsed.error);
      return res.status(400).json({ error: "Invalid payload" });
    }
    const { email, password } = parsed.data;
    console.log('Looking up user:', email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('User not found:', email);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    console.log('Comparing password...');
    const ok = await bcrypt.compare(password, user.passwordHash);
    console.log('Password match:', ok);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Server misconfigured: missing JWT_SECRET" });
  const role: Role = user.role === "admin" ? "admin" : "user";
    const ttl = process.env.TOKEN_TTL || "6h";
    const token = jwt.sign({ sub: user.id, role }, secret, { expiresIn: ttl });
    return res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
auth.get("/verify", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Note: Prisma client types may be stale in dev; fetch full user and cast for extended fields.
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ 
      ok: true, 
      user: { 
        sub: (user as any).id, 
        email: (user as any).email,
        role: ((user as any).role as Role),
        budgetCents: (user as any).budgetCents,
        maxBudgetPerQuestion: (user as any).maxBudgetPerQuestion,
        maxBatonPasses: (user as any).maxBatonPasses,
        truthinessThreshold: (user as any).truthinessThreshold
      } 
    });
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
export default auth;

/**
 * POST /auth/change-password
 * Requires Authorization: Bearer <token>
 * Body: { currentPassword: string, newPassword: string }
 */
auth.post("/change-password", requireAuth, async (req, res) => {
  try {
    const parsed = ChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

    const userId = (req as any).user?.sub as string | undefined;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

    const nextHash = await (bcrypt as any).hash(parsed.data.newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: nextHash } });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /auth/reset-password
 * Admin-only reset by email.
 * Requires Authorization: Bearer <admin token>
 * Body: { email: string, newPassword: string }
 */
auth.post("/reset-password", requireAuth, async (req, res) => {
  try {
    const parsed = AdminResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

    const requester = (req as any).user as { sub: string; role: Role } | undefined;
    if (!requester) return res.status(401).json({ error: "Unauthorized" });
    if (requester.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const nextHash = await (bcrypt as any).hash(parsed.data.newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: nextHash } });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Admin reset password error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
