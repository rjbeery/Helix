import { Router } from 'express'
import * as jwt from 'jsonwebtoken'
import * as bcrypt from 'bcryptjs'
import pkg from '@prisma/client'
import { z } from 'zod'

const { PrismaClient } = pkg
const prisma = new PrismaClient()
export const auth = Router()

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

auth.post('/login', async (req, res) => {
  const parse = LoginSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' })

  const { email, password } = parse.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  const ttl = process.env.TOKEN_TTL || '6h'
  const token = jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: ttl }
  )

  res.json({ token })
})
