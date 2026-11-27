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
    expect(soul).toMatchObject({ entryCount: 10, isOfficial: true })
    expect(rows.some((row) => row.year === 1925)).toBe(true)
  })

  it('returns the soul 1972 chart in rank order', async () => {
    const response = await get('/api/charts/soul/1972')
    expect(response.status).toBe(200)
    expect(response.body.charts).toHaveLength(1)
    expect(response.body.charts[0].entryCount).toBe(10)
    expect(response.body.charts[0].sourceName).toBe('Billboard year-end Best Selling Soul Singles')
    expect(response.body.charts[0].isOfficial).toBe(true)
    expect(response.body.songs).toHaveLength(10)
    expect(response.body.songs[0].bestRank).toBe(1)
    expect(response.body.songs[0].song.title).toBe("Let's Stay Together")
    expect(response.body.songs[0].artist.name).toBe('Al Green')
    expect(response.body.songs[0].song).toHaveProperty('youtubeVideoId')
    expect(response.body.songs.at(-1).bestRank).toBe(10)
  })

  it('returns an empty chart for a year with no list', async () => {
    const response = await get('/api/charts/jazz/1991')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ charts: [], songs: [] })
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
    const chart = await get('/api/charts/blues/1965')
    const songId = chart.body.songs[0].song.id as number
    const artistId = chart.body.songs[0].artist.id as number
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
      year_b: 1980,
    }, ctx) as { common: unknown[]; added: unknown[]; missing: unknown[] }
    expect(result.missing).toEqual([])
    expect(result.common.length + result.added.length).toBe(10)
  })

  it('reports the missing jazz year instead of inventing entries', async () => {
    const result = await executeTool(reader, 'get_chart', { genre: 'jazz', year: 1991 }, { lastSearch: null })
    expect(result).toMatchObject({ charts: [], songs: [] })
  })
})

describe('recording link', () => {
  const writer = new PrismaClient()
  let base = ''
  let songId = 0
  let previous: string | null = null
  const appPromise = buildApp({ db: reader, writer, whisperUrl: null, llm: null })

  beforeAll(async () => {
    const app = await appPromise
    await app.listen({ port: 0, host: '127.0.0.1' })
    const address = app.server.address() as AddressInfo
    base = `http://127.0.0.1:${address.port}`
    const chart = await fetch(`${base}/api/charts/soul/1972`)
    const body = await chart.json() as { songs: { song: { id: number } }[] }
    songId = body.songs[0].song.id
    const row = await writer.song.findUnique({ where: { id: songId } })
    previous = row?.youtubeVideoId ?? null
  })

  afterAll(async () => {
    if (songId) await writer.song.update({ where: { id: songId }, data: { youtubeVideoId: previous } })
    const app = await appPromise
    await app.close()
    await writer.$disconnect()
  })

  async function patch(youtubeVideoId: string | null) {
    const response = await fetch(`${base}/api/songs/${songId}/recording`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ youtubeVideoId }),
    })
    const body = await response.json()
    return { status: response.status, body }
  }

  it('stores a YouTube link and rejects a bad one', async () => {
    const bad = await patch('nope')
    expect(bad.status).toBe(400)
    const saved = await patch('https://www.youtube.com/watch?v=jNQXAC9IVRw')
    expect(saved.status).toBe(200)
    expect(saved.body.youtubeVideoId).toBe('jNQXAC9IVRw')
    const song = await fetch(`${base}/api/songs/${songId}`)
    const detail = await song.json() as { song: { youtubeVideoId: string | null } }
    expect(detail.song.youtubeVideoId).toBe('jNQXAC9IVRw')
    const cleared = await patch(null)
    expect(cleared.status).toBe(200)
    expect(cleared.body.youtubeVideoId).toBeNull()
  })
})

describe('mix playlists', () => {
  const writer = new PrismaClient()
  const created: number[] = []

  afterAll(async () => {
    if (created.length > 0) await writer.playlist.deleteMany({ where: { id: { in: created } } })
    await writer.$disconnect()
  })

  it('saves a playlist, adds an archive song, and draws a random one from soul', async () => {
    const ctx: ToolContext = { lastSearch: null }
    const named = `Mix ${Date.now()}`
    const made = await executeTool(reader, 'create_playlist', { name: named }, ctx, writer) as {
      playlist?: { id: number; entryCount: number }
      error?: string
    }
    if (made.playlist?.id) created.push(made.playlist.id)
    expect(made.error).toBeUndefined()
    expect(made.playlist?.entryCount).toBe(0)
    expect(ctx.action).toEqual({ type: 'showPlaylist', playlistId: made.playlist?.id })

    const chart = await reader.chart.findFirst({
      where: { year: 1972, genre: { slug: 'soul' } },
      include: { entries: { take: 1 } },
    })
    const songId = chart?.entries[0]?.songId
    expect(songId).toBeTypeOf('number')
    const added = await executeTool(reader, 'add_to_playlist', {
      playlist_id: made.playlist?.id,
      song_ids: [songId],
    }, { lastSearch: null }, writer) as { playlist?: { entryCount: number }; added?: { title: string }[]; error?: string }
    expect(added.error).toBeUndefined()
    expect(added.playlist?.entryCount).toBe(1)
    expect(added.added).toHaveLength(1)

    const randomCtx: ToolContext = { lastSearch: null }
    const random = await executeTool(reader, 'random_playlist', {
      genres: ['Soul'],
      count: 4,
      name: `Random ${Date.now()}`,
    }, randomCtx, writer) as {
      playlist?: { id: number; entryCount: number; name: string }
      songs?: { title: string; artist: string }[]
      error?: string
    }
    if (random.playlist?.id) created.push(random.playlist.id)
    expect(random.error).toBeUndefined()
    expect(random.playlist?.entryCount).toBe(4)
    expect(random.songs).toHaveLength(4)
    expect(randomCtx.action).toEqual({ type: 'showPlaylist', playlistId: random.playlist?.id })

    const unknown = await executeTool(reader, 'random_playlist', {
      genres: ['not-a-genre'],
      name: 'Nope',
    }, { lastSearch: null }, writer) as { error?: string }
    expect(unknown.error).toMatch(/Unknown genre/)
  })
})

afterAll(async () => {
  await reader.$disconnect()
})
