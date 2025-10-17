import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs"; // if TS complains, enable esModuleInterop or use: import * as bcrypt from "bcryptjs";

const app = express();
app.use(cors());
app.use(express.json());

// Back-compat (single code) and new two-role setup
const SINGLE_HASH = process.env.HELIX_PASS_HASH || "";
const MASTER_HASH = process.env.MASTER_PASS_HASH || "";
const FNBO_HASH   = process.env.FNBO_PASS_HASH   || "";

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/auth", async (req, res) => {
  const passphrase = req.body?.passphrase;
  if (typeof passphrase !== "string") return res.status(400).json({ ok: false });

  // Two-role mode takes precedence if either role hash is present
  if (MASTER_HASH || FNBO_HASH) {
    const isMaster = MASTER_HASH && await bcrypt.compare(passphrase, MASTER_HASH);
    if (isMaster) return res.json({ ok: true, role: "master" });

    const isFnbo = FNBO_HASH && await bcrypt.compare(passphrase, FNBO_HASH);
    if (isFnbo) return res.json({ ok: true, role: "fnbo" });

    return res.status(401).json({ ok: false });
  }

  // Legacy single-hash mode
  const ok = SINGLE_HASH && await bcrypt.compare(passphrase, SINGLE_HASH);
  return ok ? res.json({ ok: true }) : res.status(401).json({ ok: false });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`helix-api listening on ${port}`));
