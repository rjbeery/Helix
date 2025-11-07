// Load local .env in development for API keys and DB config
import "dotenv/config";

import express from "express";

async function bootstrap() {
  const PORT = Number(process.env.PORT ?? 3001);
  let serverApp: import('express').Express;
  try {
    // Dynamically import the real app; this lets us catch boot-time errors (e.g., Prisma/env issues)
    const mod = await import("./app");
    serverApp = (mod as any).app as import('express').Express;
  } catch (err: any) {
    console.error("[bootstrap] Failed to load app:", err?.stack || err);
    // Fallback minimal app so the container stays up and we can inspect logs
    const fallback = express();
    fallback.get("/health", (_req, res) => res.status(200).json({ ok: false, bootError: true }));
    fallback.get("/boot-error", (_req, res) => res.status(200).send(String(err?.stack || err)));
    serverApp = fallback;
  }

  serverApp.listen(PORT, () => {
    console.log(`🚀 helix-api listening on http://localhost:${PORT}`);
    console.log(`📝 Health:  http://localhost:${PORT}/health`);
    console.log(`🔐 Login:   POST http://localhost:${PORT}/auth/login`);
  });
}

bootstrap();
