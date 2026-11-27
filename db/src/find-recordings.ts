import { parse } from 'csv-parse/sync'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SOUL_LISTENING } from './soul-listening.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'data', 'recordings.json')

type Recording = {
  title: string
  artist: string
  youtubeVideoId: string
  matchedTitle: string
}

const STOP = new Set(['the', 'and', 'with', 'from', 'that', 'this', 'your', 'you', 'for', 'love'])

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP.has(token))
}

function songs(): { title: string; artist: string }[] {
  const seen = new Set<string>()
  const rows: { title: string; artist: string }[] = []
  function add(title: string, artist: string) {
    const key = `${title}\0${artist}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({ title, artist })
  }
  for (const folder of ['soul', 'blues', 'jazz', 'gospel', 'rnb', 'classical', 'ragtime']) {
    const dir = join(root, 'data', folder)
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.csv')) continue
      const table = parse(readFileSync(join(dir, name)), { columns: true, skip_empty_lines: true }) as { title: string; artist: string }[]
      for (const row of table) add(row.title, row.artist)
    }
  }
  for (const year of SOUL_LISTENING) {
    for (const song of year.songs) add(song.title, song.artist)
  }
  return rows
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function search(query: string): Promise<string[]> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'en' },
      })
      if (response.status === 429) {
        await sleep(4000 * (attempt + 1))
        continue
      }
      if (!response.ok) throw new Error(`YouTube search ${response.status}`)
      const html = await response.text()
      return [...new Set([...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((match) => match[1]))].slice(0, 5)
    } catch (error) {
      if (attempt === 3) throw error
      await sleep(2000 * (attempt + 1))
    }
  }
  return []
}

async function embedTitle(id: string): Promise<{ title: string; author: string } | null> {
  const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`)
  if (!response.ok) return null
  const body = await response.json() as { title?: string; author_name?: string }
  if (!body.title) return null
  return { title: body.title, author: body.author_name ?? '' }
}

function score(song: { title: string; artist: string }, video: { title: string; author: string }): number {
  const haystack = `${video.title} ${video.author}`.toLowerCase()
  const titleTokens = tokens(song.title)
  const artistTokens = tokens(song.artist)
  const titleHits = titleTokens.filter((token) => haystack.includes(token)).length
  if (titleTokens.length > 0 && titleHits === 0) return -1
  if (titleTokens.length >= 2 && titleHits < 2) return -1
  const artistHit = artistTokens.some((token) => haystack.includes(token))
  if (titleTokens.length <= 1 && !artistHit) return -1
  let value = titleHits + (artistHit ? 2 : 0)
  if (/official/.test(haystack)) value += 1
  if (/lyric/.test(haystack)) value -= 1
  if (/karaoke|reaction|tutorial|nightcore|sped up|cover by|tribute/.test(haystack)) value -= 3
  return value
}

function loadExisting(): Recording[] {
  try {
    return JSON.parse(readFileSync(outPath, 'utf8')) as Recording[]
  } catch {
    return []
  }
}

async function main(): Promise<void> {
  const existing = loadExisting()
  const done = new Set(existing.map((row) => `${row.title}\0${row.artist}`))
  const pending = songs().filter((song) => !done.has(`${song.title}\0${song.artist}`))
  console.log(`${existing.length} already saved, ${pending.length} to look up.`)
  const found = [...existing]
  for (const song of pending) {
    const query = `${song.artist} ${song.title}`
    let chosen: Recording | null = null
    try {
      const ids = await search(query)
      let best = -1
      for (const id of ids) {
        const video = await embedTitle(id)
        if (!video) continue
        const value = score(song, video)
        if (value > best) {
          best = value
          chosen = { title: song.title, artist: song.artist, youtubeVideoId: id, matchedTitle: video.title }
        }
      }
    } catch (error) {
      console.error(`Failed ${query}:`, error instanceof Error ? error.message : error)
    }
    if (chosen && bestEnough(chosen)) {
      found.push(chosen)
      console.log(`Linked ${song.artist} — ${song.title} -> ${chosen.youtubeVideoId} (${chosen.matchedTitle})`)
    } else {
      console.log(`No match ${song.artist} — ${song.title}`)
    }
    writeFileSync(outPath, `${JSON.stringify(found, null, 2)}\n`)
    await sleep(1200)
  }
  console.log(`Saved ${found.length} recordings.`)
}

function bestEnough(row: Recording): boolean {
  return row.youtubeVideoId.length === 11
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
