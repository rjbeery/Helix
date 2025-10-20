import express from 'express'

export const app = express()

app.use(express.json())

// routes
app.get('/health', (_req, res) => res.json({ ok: true }))

// export only — no app.listen() here
