import express from 'express'
import { auth } from './routes/auth'
import { requireAuth } from './middleware/requireAuth'

export const app = express()

app.use(express.json())

// routes
app.get('/health', (_req, res) => res.json({ ok: true }))
app.use('/auth', auth)
app.get('/v1/me', requireAuth, (req, res) => {
  res.json({ userId: (req as any).user.sub, role: (req as any).user.role })
})

// export only — no app.listen() here
