import { PrismaClient } from '@prisma/client'
import { loadEnv } from './env.js'
import { linkRecordings } from './recordings.js'

loadEnv()

const prisma = new PrismaClient()
try {
  const linked = await linkRecordings(prisma)
  console.log(`Linked ${linked} songs that had no recording yet.`)
} finally {
  await prisma.$disconnect()
}
