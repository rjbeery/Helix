import { Router } from "express";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import pkg from "@prisma/client";
import { z } from "zod";
import type { Role } from "../types/auth";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
export const auth = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

auth.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: "Server misconfigured: missing JWT_SECRET" });

  // Coerce/normalize role to our public set (no “fnbo” anywhere)
  const role: Role = user.role === "master" ? "master" : "guest";

  const ttl = process.env.TOKEN_TTL || "6h";
  const token = jwt.sign({ sub: user.id, role }, secret, { expiresIn: ttl });

  return res.json({ token });
});
