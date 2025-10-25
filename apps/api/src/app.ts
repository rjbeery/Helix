import express from "express";
import cors from "cors";
import auth from "./routes/auth.js";
import { requireAuth, type AuthedRequest } from "./middleware/requireAuth.js";

export const app = express();

// CORS: allow local dev and production site by default; override via ALLOWED_ORIGINS (comma-separated)
const defaultOrigins = ["http://localhost:5173", "https://helixai.live"];
const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(",") || defaultOrigins).map((s) => s.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow server-to-server or curl
      const ok = allowedOrigins.some((o) => o === "*" || o === origin);
      return cb(ok ? null : new Error("Not allowed by CORS"), ok);
    },
    credentials: true,
  })
);
app.use(express.json());

// health
app.get("/health", (_req, res) => res.json({ ok: true }));

// auth routes
app.use("/auth", auth);

// simple protected probe
app.get("/v1/me", requireAuth, (req, res) => {
  const u = (req as AuthedRequest).user!;
  res.json({ userId: u.sub, role: u.role });
});
