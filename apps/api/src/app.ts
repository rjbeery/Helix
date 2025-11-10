import express, { type Express } from "express";
import cors from "cors";
import auth from "./routes/auth.js";
import personas from "./routes/personas.js";
import chat from "./routes/chat.js";
import users from "./routes/users.js";
import { requireAuth, type AuthedRequest } from "./middleware/requireAuth.js";
import { initSecrets } from "./config/secrets.js";
import dbRouter from "./routes/db.js";
// Initialize secrets at cold start (no-op locally)
await initSecrets();
export const app: Express = express();
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
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(express.json());

// Request logging for debugging (only log persona routes to minimize noise)
app.use('/api/personas', (req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}, Auth: ${req.headers.authorization ? 'present' : 'missing'}`);
  next();
});

// Static file serving for local avatar uploads (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static('uploads'));
}
// health
app.get("/health", (_req, res) => res.json({ ok: true }));
// db health (connectivity to database)
app.use("/db", dbRouter);
// auth routes
app.use("/auth", auth);
// personas routes (protected)
app.use("/api/personas", requireAuth, personas);
// chat routes (protected)
app.use("/api/chat", requireAuth, chat);
// users routes (protected)
app.use("/api/users", requireAuth, users);
// simple protected probe
app.get("/v1/me", requireAuth, (req, res) => {
  const u = (req as AuthedRequest).user!;
  res.json({ userId: u.sub, role: u.role });
});
