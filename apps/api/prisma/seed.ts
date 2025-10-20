import pkg from '@prisma/client'
import bcrypt from 'bcryptjs'          // ← bcryptjs
const { PrismaClient } = pkg
const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL
  const pass  = process.env.ADMIN_PASSWORD
  if (!email || !pass) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD')

  const passwordHash = await bcrypt.hash(pass, 10)  // bcryptjs API matches
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'admin' },
    create: { email, passwordHash, role: 'admin', budgetCents: 10_000 },
  })
  console.log('Admin ensured:', email)
}
main().finally(() => prisma.$disconnect())
