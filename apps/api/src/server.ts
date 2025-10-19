import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

const PassReq = z.object({ passcode: z.string().min(1) });
app.post("/v1/auth/verify", (req, res) => {
  const parsed = PassReq.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "bad_request" });

  const ok = parsed.data.passcode === (process.env.TEST_PASSCODE ?? "letmein");
  if (!ok) return res.status(401).json({ ok: false });
  res.json({ ok: true, token: "dev-token" });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
