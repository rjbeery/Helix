import express from "express";
import cors from "cors";
import auth from "./routes/auth";
import { requireAuth, type AuthedRequest } from "./middleware/requireAuth";

export const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", auth);

app.get("/v1/me", requireAuth, (req, res) => {
  const u = (req as AuthedRequest).user!;
  res.json({ userId: u.sub, role: u.role });
});
