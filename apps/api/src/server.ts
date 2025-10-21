// apps/api/src/server.ts
import 'dotenv/config'
import { app } from './app'

const PORT = Number(process.env.PORT) || 3001

app.listen(PORT, () => {
  console.log(`🚀 helix-api listening on http://localhost:${PORT}`)
  console.log(`📝 Health:  http://localhost:${PORT}/health`)
  console.log(`🔐 Login:   POST http://localhost:${PORT}/auth/login`)
})
