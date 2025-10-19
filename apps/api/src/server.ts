
import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt, { SignOptions, Secret } from "jsonwebtoken";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// --- env ---
const PORT = Number(process.env.PORT || 3001);
const MASTER_PASS_HASH = process.env.MASTER_PASS_HASH || "";
const FNBO_PASS_HASH = process.env.FNBO_PASS_HASH || "";
const JWT_SECRET = (process.env.JWT_SECRET || "dev-secret") as Secret;
const TOKEN_TTL = process.env.TOKEN_TTL || "24h";

// shared auth handler (so we can mount it at /auth/verify AND /api/auth/verify)
async function verifyHandler(req: Request, res: Response) {
  try {
    const { passcode, role } = (req.body ?? {}) as {
      passcode?: string;
      role?: "master" | "fnbo";
    };
    if (!passcode) return res.status(400).json({ error: "passcode required" });

    const target: "master" | "fnbo" = role === "fnbo" ? "fnbo" : "master";
    const hash = target === "master" ? MASTER_PASS_HASH : FNBO_PASS_HASH;
    if (!hash) {
      return res
        .status(500)
        .json({ error: `hash for role '${target}' not configured` });
    }

    const ok = await bcrypt.compare(passcode, hash);
    if (!ok) return res.status(401).json({ error: "invalid passcode" });

    const token = jwt.sign({ role: target }, JWT_SECRET, { expiresIn: TOKEN_TTL } as SignOptions);
    const { exp } = jwt.decode(token) as { exp?: number };
    res.json({ token, role: target, exp });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "auth error" });
  }
}

// health
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/", (_req, res) => res.send("helix-api ok"));

// auth endpoints at both paths to avoid prefix confusion
app.post("/api/auth/verify", verifyHandler);
app.post("/auth/verify", verifyHandler);

// debug: list routes (GET /__routes)
app.get("/__routes", (_req, res) => {
  // @ts-ignore
  const stack = app._router?.stack ?? [];
  const routes = stack
    .filter((l: any) => l.route)
    .map((l: any) => ({ methods: Object.keys(l.route.methods), path: l.route.path }));
  res.json(routes);
});

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => console.log(`helix-api listening on ${PORT}`));
// (removed duplicate app.listen)
