import { PrismaClient } from '@prisma/client'
import { loadEnv } from './env.js'

loadEnv()

const readonlyUrl = process.env.DATABASE_URL_READONLY
if (!readonlyUrl) {
  throw new Error('DATABASE_URL_READONLY is required')
}

export const reader = new PrismaClient({ datasourceUrl: readonlyUrl })
