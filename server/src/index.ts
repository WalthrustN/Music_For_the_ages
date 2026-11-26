import { buildApp } from './app.js'
import { createLLMClient } from './llm/clients.js'
import type { LLMClient } from './llm/types.js'
import { reader, writer } from './db.js'

const port = Number(process.env.PORT ?? 3011)
let llm: LLMClient | null = null
try {
  llm = createLLMClient(process.env)
} catch (error) {
  console.warn(error instanceof Error ? error.message : error)
}

const app = await buildApp({
  db: reader,
  writer,
  llm,
  whisperUrl: process.env.WHISPER_URL || null,
  logTools: process.env.NODE_ENV !== 'production',
})

await app.listen({ port, host: '127.0.0.1' })
console.log(`API listening on http://127.0.0.1:${port}`)
