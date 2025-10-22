import express from "express";
import cors from "cors";
import auth from "./routes/auth.js";
import { requireAuth, type AuthedRequest } from "./middleware/requireAuth.js";

export const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
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
