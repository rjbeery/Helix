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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, budgetCents: true, maxBudgetPerQuestion: true, maxBatonPasses: true, truthinessThreshold: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ 
      ok: true, 
      user: { 
        sub: user.id, 
        email: user.email,
        role: user.role as Role,
        budgetCents: user.budgetCents,
        maxBudgetPerQuestion: user.maxBudgetPerQuestion,
        maxBatonPasses: user.maxBatonPasses,
        truthinessThreshold: user.truthinessThreshold
      } 
    });
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
export default auth;
