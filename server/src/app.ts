import multipart from '@fastify/multipart'
import type { PrismaClient } from '@prisma/client'
import Fastify, { type FastifyReply } from 'fastify'
import { z, type ZodType } from 'zod'
import { runAssistant } from './llm/loop.js'
import { systemPrompt } from './llm/prompt.js'
import { executeTool, TOOL_DEFINITIONS, type ToolContext } from './llm/tools.js'
import type { LLMClient } from './llm/types.js'
import {
  getArtistHistory,
  getChart,
  getSongDetail,
  listCoverage,
  listGenres,
  searchSongs,
} from './queries.js'

export type AppDeps = {
  db: PrismaClient
  whisperUrl?: string | null
  llm?: LLMClient | null
  logTools?: boolean
}

const yearParam = z.coerce.number().int().min(1925).max(2100)

function parseOr400<T>(schema: ZodType<T>, value: unknown, reply: FastifyReply): T | null {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    reply.code(400).send({
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
    return null
  }
  return parsed.data
}

function extractTranscript(payload: unknown): string {
  if (!payload) return ''
  if (typeof payload === 'string') return payload
  if (typeof payload === 'object' && payload && 'text' in payload && typeof payload.text === 'string') {
    return payload.text
  }
  return ''
}

export async function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: false })
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } })

  app.setErrorHandler((error, _request, reply) => {
    const status = error.statusCode ?? 500
    if (status >= 500) app.log.error(error)
    reply.code(status).send({
      error: status >= 500 ? 'Internal server error' : error.message,
    })
  })

  app.get('/api/genres', async () => ({ genres: await listGenres(deps.db) }))

  app.get('/api/coverage', async () => ({ coverage: await listCoverage(deps.db) }))

  app.get('/api/charts/:genre/:year', async (request, reply) => {
    const params = parseOr400(
      z.object({ genre: z.string().min(1), year: yearParam }),
      request.params,
      reply,
    )
    if (!params) return
    const chart = await getChart(deps.db, params.genre, params.year)
    if (!chart) return reply.code(404).send({ error: `Unknown genre "${params.genre}"` })
    return chart
  })

  app.get('/api/search', async (request, reply) => {
    const query = parseOr400(
      z.object({
        q: z.string().optional(),
        genre: z.string().optional(),
        yearFrom: z.coerce.number().int().optional(),
        yearTo: z.coerce.number().int().optional(),
        rankMax: z.coerce.number().int().min(1).max(100).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
      }),
      request.query,
      reply,
    )
    if (!query) return
    const results = await searchSongs(deps.db, {
      text: query.q,
      genre: query.genre || undefined,
      yearFrom: query.yearFrom,
      yearTo: query.yearTo,
      rankMax: query.rankMax,
      limit: query.limit ?? 25,
    })
    return { results }
  })

  app.get('/api/artists/:id/history', async (request, reply) => {
    const params = parseOr400(z.object({ id: z.coerce.number().int().positive() }), request.params, reply)
    if (!params) return
    const history = await getArtistHistory(deps.db, params.id)
    if (!history) return reply.code(404).send({ error: 'Artist not found' })
    return history
  })

  app.get('/api/songs/:id', async (request, reply) => {
    const params = parseOr400(z.object({ id: z.coerce.number().int().positive() }), request.params, reply)
    if (!params) return
    const song = await getSongDetail(deps.db, params.id)
    if (!song) return reply.code(404).send({ error: 'Song not found' })
    return song
  })

  app.post('/api/assistant', async (request, reply) => {
    if (!deps.llm) {
      return reply.code(503).send({ error: 'The assistant is not configured. Set LLM_PROVIDER and start Ollama, or add an API key.' })
    }
    const body = parseOr400(
      z.object({
        message: z.string().trim().min(1).max(4000),
        history: z.array(z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().max(8000),
        })).max(40).optional(),
      }),
      request.body,
      reply,
    )
    if (!body) return
    const genres = await listGenres(deps.db)
    const ctx: ToolContext = { lastSearch: null }
    const result = await runAssistant({
      client: deps.llm,
      system: systemPrompt(genres),
      message: body.message,
      history: body.history ?? [],
      tools: TOOL_DEFINITIONS,
      getAction: () => ctx.action,
      log: deps.logTools ? (line) => console.log(line) : undefined,
      execute: (name, args) => executeTool(deps.db, name, args, ctx),
    })
    return { answer: result.answer, action: result.action }
  })

  app.post('/api/transcribe', async (request, reply) => {
    if (!deps.whisperUrl) {
      return reply.code(501).send({ error: 'Voice fallback not configured — type instead' })
    }
    const file = await request.file()
    if (!file) return reply.code(400).send({ error: 'Audio file is required' })
    const bytes = await file.toBuffer()
    const form = new FormData()
    form.append('file', new Blob([bytes]), file.filename || 'speech.webm')
    form.append('response_format', 'json')
    const endpoint = deps.whisperUrl.endsWith('/inference')
      ? deps.whisperUrl
      : `${deps.whisperUrl.replace(/\/$/, '')}/inference`
    let response: Response
    try {
      response = await fetch(endpoint, { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Whisper request failed'
      return reply.code(502).send({ error: `Whisper server is unreachable. ${message}` })
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300)
      return reply.code(502).send({ error: 'Whisper server rejected the audio', detail })
    }
    const payload: unknown = await response.json()
    return { text: extractTranscript(payload) }
  })

  return app
}
