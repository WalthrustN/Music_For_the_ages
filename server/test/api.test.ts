import { PrismaClient } from '@prisma/client'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { executeTool, type ToolContext } from '../src/llm/tools.js'

const reader = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_READONLY })

describe('read API', () => {
  let base = ''
  const appPromise = buildApp({ db: reader, whisperUrl: null, llm: null })

  beforeAll(async () => {
    const app = await appPromise
    await app.listen({ port: 0, host: '127.0.0.1' })
    const address = app.server.address() as AddressInfo
    base = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    const app = await appPromise
    await app.close()
  })

  async function get(path: string) {
    const response = await fetch(base + path)
    const body = await response.json()
    return { status: response.status, body }
  }

  it('lists the seeded genres', async () => {
    const response = await get('/api/genres')
    expect(response.status).toBe(200)
    expect(response.body.genres.map((genre: { slug: string }) => genre.slug)).toContain('rap-hip-hop')
    expect(response.body.genres.map((genre: { slug: string }) => genre.slug)).toContain('rnb')
  })

  it('returns a coverage cell for the missing jazz chart and the short soul chart', async () => {
    const response = await get('/api/coverage')
    expect(response.status).toBe(200)
    const rows = response.body.coverage as { genreSlug: string; year: number; entryCount: number; isOfficial: boolean | null }[]
    const jazz = rows.find((row) => row.genreSlug === 'jazz' && row.year === 1991)
    const soul = rows.find((row) => row.genreSlug === 'soul' && row.year === 1972)
    expect(jazz).toMatchObject({ entryCount: 0, isOfficial: null })
    expect(soul).toMatchObject({ entryCount: 37, isOfficial: false })
    expect(rows.some((row) => row.year === 1925)).toBe(true)
  })

  it('returns the soul 1972 chart in rank order', async () => {
    const response = await get('/api/charts/soul/1972')
    expect(response.status).toBe(200)
    expect(response.body.chart.entryCount).toBe(37)
    expect(response.body.chart.sourceName).toMatch(/Mock/)
    expect(response.body.chart.sourceUrl).toBe('https://example.com/mock-soul-1972')
    expect(response.body.entries[0].rank).toBe(1)
    expect(response.body.entries[0].song.title).toMatch(/^Mock Song /)
    expect(response.body.entries.at(-1).rank).toBe(37)
  })

  it('returns an empty chart for a year with no list', async () => {
    const response = await get('/api/charts/jazz/1991')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ chart: null, entries: [] })
  })

  it('rejects a search limit above 50 and finds a mock title', async () => {
    const tooMany = await get('/api/search?q=mock&limit=51')
    expect(tooMany.status).toBe(400)
    const found = await get('/api/search?q=Mock%20Song%2012&limit=5')
    expect(found.status).toBe(200)
    expect(found.body.results.length).toBeGreaterThan(0)
    expect(found.body.results[0].title).toBe('Mock Song 12')
  })

  it('returns song and artist history', async () => {
    const chart = await get('/api/charts/soul/1965')
    const songId = chart.body.entries[0].song.id as number
    const artistId = chart.body.entries[0].artist.id as number
    const song = await get(`/api/songs/${songId}`)
    expect(song.status).toBe(200)
    expect(song.body.appearances.length).toBeGreaterThan(0)
    const artist = await get(`/api/artists/${artistId}/history`)
    expect(artist.status).toBe(200)
    expect(artist.body.artist.name).toMatch(/Mock Artist/)
  })

  it('answers 501 when whisper is not configured', async () => {
    const response = await fetch(base + '/api/transcribe', { method: 'POST' })
    const body = await response.json()
    expect(response.status).toBe(501)
    expect(body.error).toBe('Voice fallback not configured — type instead')
  })
})

describe('read-only tools', () => {
  it('refuses inserts from chart_reader', async () => {
    await expect(reader.genre.create({
      data: { slug: 'not-allowed', name: 'Not allowed', sortOrder: 999 },
    })).rejects.toThrow()
  })

  it('compares two soul charts from tool results only', async () => {
    const ctx: ToolContext = { lastSearch: null }
    const result = await executeTool(reader, 'compare_years', {
      genre: 'soul',
      year_a: 1972,
      year_b: 2004,
    }, ctx) as { common: unknown[]; added: unknown[]; missing: unknown[] }
    expect(result.missing).toEqual([])
    expect(result.common.length + result.added.length).toBe(50)
  })

  it('reports the missing jazz year instead of inventing entries', async () => {
    const result = await executeTool(reader, 'get_chart', { genre: 'jazz', year: 1991 }, { lastSearch: null })
    expect(result).toMatchObject({ chart: null, entries: [] })
  })
})

afterAll(async () => {
  await reader.$disconnect()
})
