import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";

const app = express();
app.use(cors());
app.use(express.json());

const HASH = process.env.HELIX_PASS_HASH || "";

app.post("/auth", async (req, res) => {
  const passphrase = req.body?.passphrase;
  if (typeof passphrase !== "string") return res.status(400).json({ ok: false });
  const ok = HASH && await bcrypt.compare(passphrase, HASH);
  return ok ? res.json({ ok: true }) : res.status(401).json({ ok: false });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`helix-api listening on ${port}`));
