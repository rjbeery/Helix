import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt, { SignOptions, Secret } from "jsonwebtoken";
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { randomUUID } from "crypto";
import { app } from './app'

// Initialize Prisma client
const prisma = new PrismaClient();

// Define JWT payload interface
interface JwtPayload {
  role: "master" | "fnbo";
  userId?: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request to include auth data
interface AuthRequest extends Request {
  user?: {
    role: "master" | "fnbo";
    userId?: string;
  };
  traceId?: string;
}

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// --- env ---
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
const MASTER_PASS_HASH = process.env.MASTER_PASS_HASH || "";
const FNBO_PASS_HASH = process.env.FNBO_PASS_HASH || "";
const JWT_SECRET = (process.env.JWT_SECRET || "dev-secret") as Secret;
const TOKEN_TTL = process.env.TOKEN_TTL || "24h";

// Add trace ID to all requests for better logging
app.use((req: AuthRequest, res: Response, next: NextFunction) => {
  req.traceId = randomUUID();
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      traceId: req.traceId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      timestamp: new Date().toISOString()
    }));
  });
  
  next();
});

// JWT Verification Middleware
function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    
    const payload = decoded as JwtPayload;
    req.user = {
      role: payload.role,
      userId: payload.userId
    };
    next();
  });
}

// Shared auth handler (keeping your existing logic)
async function verifyHandler(req: AuthRequest, res: Response) {
  try {
    const { passcode, role } = (req.body ?? {}) as {
      passcode?: string;
      role?: "master" | "fnbo";
    };
    
    if (!passcode) {
      return res.status(400).json({ error: "passcode required" });
    }

    const target: "master" | "fnbo" = role === "fnbo" ? "fnbo" : "master";
    const hash = target === "master" ? MASTER_PASS_HASH : FNBO_PASS_HASH;
    
    if (!hash) {
      return res.status(500).json({ error: `hash for role '${target}' not configured` });
    }

    const ok = await bcrypt.compare(passcode, hash);
    if (!ok) {
      return res.status(401).json({ error: "invalid passcode" });
    }

    // TODO: Once Prisma schema is set up, look up or create user here
    // const user = await prisma.user.findFirst({ where: { role: target } });

    const token = jwt.sign(
      { 
        role: target,
        // userId: user?.id  // Add this once we have users table
      }, 
      JWT_SECRET, 
      { expiresIn: TOKEN_TTL } as SignOptions
    );
    
    const { exp } = jwt.decode(token) as JwtPayload;
    
    console.log(JSON.stringify({
      traceId: req.traceId,
      event: "auth_success",
      role: target,
      timestamp: new Date().toISOString()
    }));
    
    res.json({ token, role: target, exp });
  } catch (e) {
    console.error(JSON.stringify({
      traceId: req.traceId,
      event: "auth_error",
      error: e instanceof Error ? e.message : "Unknown error",
      timestamp: new Date().toISOString()
    }));
    res.status(500).json({ error: "auth error" });
  }
}

// Health endpoints (keeping your existing ones)
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/", (_req, res) => res.send("helix-api ok"));

// Auth endpoints at both paths (keeping your approach)
app.post("/api/auth/verify", verifyHandler);
app.post("/auth/verify", verifyHandler);

// Protected v1 routes - these require JWT authentication
app.get("/v1/user", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // TODO: Fetch user from database once Prisma schema is ready
    res.json({
      role: req.user?.role,
      // Will add more user data once DB is set up
      message: "User endpoint working - database integration pending"
    });
  } catch (error) {
    console.error(JSON.stringify({
      traceId: req.traceId,
      event: "user_fetch_error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }));
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// Example protected route for AI agent invocation (placeholder)
app.post("/v1/invoke", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { persona, messages } = req.body;
  
  // TODO: Implement orchestrator logic
  res.json({
    message: "Agent invocation endpoint - implementation pending",
    receivedPersona: persona,
    messageCount: messages?.length || 0
  });
});

// Debug: list routes (keeping your debug endpoint)
app.get("/__routes", (_req, res) => {
  // @ts-ignore
  const stack = app._router?.stack ?? [];
  const routes = stack
    .filter((l: any) => l.route)
    .map((l: any) => ({ 
      methods: Object.keys(l.route.methods), 
      path: l.route.path 
    }));
  res.json(routes);
});

// Global error handler
app.use((err: Error, req: AuthRequest, res: Response, next: NextFunction) => {
  console.error(JSON.stringify({
    traceId: req.traceId,
    event: "unhandled_error",
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString()
  }));
  
  res.status(500).json({
    error: "Internal server error",
    traceId: req.traceId,
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// 404 handler (keeping yours)
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 helix-api listening on ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoint: http://localhost:${PORT}/auth/verify`);
  console.log(`🛠️  Debug routes: http://localhost:${PORT}/__routes`);
});