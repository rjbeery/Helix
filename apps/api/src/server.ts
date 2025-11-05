// Load local .env in development for API keys and DB config
import "dotenv/config";
import { app } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`🚀 helix-api listening on http://localhost:${PORT}`);
  console.log(`📝 Health:  http://localhost:${PORT}/health`);
  console.log(`🔐 Login:   POST http://localhost:${PORT}/auth/login`);
});
// In containers, env vars are provided by docker-compose; no dotenv needed at runtime.
