import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import {
  compareYears,
  findArtistsByName,
  getArtistHistory,
  getChart,
  getSongDetail,
  listCoverage,
  searchSongs,
  type SearchHit,
} from '../queries.js'
import {
  addSongsToPlaylist,
  createMixPlaylist,
  createRandomPlaylist,
  findMixPlaylist,
} from '../playlists.js'
import type { ToolDefinition } from './types.js'

const year = z.number().int().min(1860).max(2100)

const argumentSchemas = {
  get_chart: z.object({ genre: z.string().min(1), year }),
  search_songs: z.object({
    text: z.string().optional(),
    artist: z.string().optional(),
    genre: z.string().optional(),
    year_from: year.optional(),
    year_to: year.optional(),
    rank_max: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  artist_history: z.object({ artist_name: z.string().min(1) }),
  compare_years: z.object({ genre: z.string().min(1), year_a: year, year_b: year }),
  coverage: z.object({ genre: z.string().min(1).optional() }),
  create_playlist: z.object({ name: z.string().trim().min(1).max(120) }),
  add_to_playlist: z.object({
    playlist_id: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    song_ids: z.array(z.number().int().positive()).min(1).max(40),
  }),
  random_playlist: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    genres: z.array(z.string().trim().min(1)).min(1).max(14),
    count: z.number().int().min(1).max(40).optional(),
  }),
  set_ui_action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('showChart'), genre: z.string().min(1), year }),
    z.object({ type: z.literal('showResults') }),
    z.object({ type: z.literal('scrollToRank'), rank: z.number().int().min(1).max(100) }),
    z.object({
      type: z.literal('showArtist'),
      artistId: z.number().int().positive().optional(),
      artistName: z.string().min(1).optional(),
    }),
    z.object({
      type: z.literal('playSong'),
      songId: z.coerce.number().int().positive(),
    }),
  ]),
}

const objectSchema = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_chart',
    description: 'Get one genre chart for a year, including its source and ranked songs. Returns no chart when that year was never entered.',
    parameters: objectSchema({
      genre: { type: 'string', description: 'Genre slug, such as rnb or rap-hip-hop' },
      year: { type: 'integer' },
    }, ['genre', 'year']),
  },
  {
    name: 'search_songs',
    description: 'Search chart entries. At least one of text, artist, genre, or a year bound is required. limit cannot exceed 50.',
    parameters: objectSchema({
      text: { type: 'string' },
      artist: { type: 'string' },
      genre: { type: 'string' },
      year_from: { type: 'integer' },
      year_to: { type: 'integer' },
      rank_max: { type: 'integer' },
      limit: { type: 'integer' },
    }, []),
  },
  {
    name: 'artist_history',
    description: 'Every chart appearance for an artist, matched by name.',
    parameters: objectSchema({ artist_name: { type: 'string' } }, ['artist_name']),
  },
  {
    name: 'compare_years',
    description: 'Compare two charts in one genre. common lists songs on both. added lists songs in year_b that are not in year_a.',
    parameters: objectSchema({
      genre: { type: 'string' },
      year_a: { type: 'integer' },
      year_b: { type: 'integer' },
    }, ['genre', 'year_a', 'year_b']),
  },
  {
    name: 'coverage',
    description: 'Which years have a chart. Omit genre for every genre. entryCount 0 means no list is on record.',
    parameters: objectSchema({ genre: { type: 'string' } }, []),
  },
  {
    name: 'create_playlist',
    description: 'Save an empty playlist by name. Songs are added afterwards with add_to_playlist, using ids that already exist in the archive.',
    parameters: objectSchema({
      name: { type: 'string', description: 'Playlist name' },
    }, ['name']),
  },
  {
    name: 'add_to_playlist',
    description: 'Add archive songs to a playlist. song_ids must come from search_songs or get_chart. Pass playlist_id from create_playlist, or the playlist name. Does not invent songs.',
    parameters: objectSchema({
      playlist_id: { type: 'integer' },
      name: { type: 'string' },
      song_ids: { type: 'array', items: { type: 'integer' }, description: 'Song ids already returned by a tool' },
    }, ['song_ids']),
  },
  {
    name: 'random_playlist',
    description: 'Create a playlist by sampling songs that charted in the named genres. Songs come only from the archive. Pass genre slugs and an optional count from 1 to 40.',
    parameters: objectSchema({
      name: { type: 'string', description: 'Playlist name. Omit to name it after the genres.' },
      genres: { type: 'array', items: { type: 'string' }, description: 'Genre slugs, such as soul or jazz' },
      count: { type: 'integer', description: 'How many songs to draw. Defaults to 12.' },
    }, ['genres']),
  },
  {
    name: 'set_ui_action',
    description: 'Ask the screen to show a chart, the last search, a rank, an artist, or to play a song. playSong looks the song up by songId from search_songs or song.id from get_chart and starts that recording when the archive has one.',
    parameters: objectSchema({
      type: { type: 'string', enum: ['showChart', 'showResults', 'scrollToRank', 'showArtist', 'playSong'] },
      genre: { type: 'string' },
      year: { type: 'integer' },
      rank: { type: 'integer' },
      artistId: { type: 'integer' },
      artistName: { type: 'string' },
      songId: { type: 'integer', description: 'songId from search_songs, or song.id from get_chart' },
    }, ['type']),
  },
]

export type UiAction =
  | { type: 'showChart'; genre: string; year: number; rank?: number }
  | { type: 'showResults'; results: SearchHit[] }
  | { type: 'scrollToRank'; rank: number }
  | { type: 'showArtist'; artistId: number }
  | {
      type: 'playSong'
      songId: number
      title: string
      artist: string
      videoId: string | null
      genre?: string
      year?: number
      rank?: number
    }
  | { type: 'showPlaylist'; playlistId: number }

export type ToolContext = {
  lastSearch: SearchHit[] | null
  action?: UiAction
  rank?: number
}

const PLAY_VERB = /\b(play|hear|put on|listen to)\b/i
const QUESTION = /\b(who|what|when|where|why|which|how|compare|empty|coverage|list|show|about|history)\b/i

export function messageAsksToPlay(message: string): boolean {
  const text = message.trim()
  if (/\bplaylist\b/i.test(text)) return false
  if (PLAY_VERB.test(text)) return true
  if (text.includes('?') || QUESTION.test(text)) return false
  const words = text.split(/\s+/).filter(Boolean)
  return words.length > 0 && words.length <= 6
}

export function playQuery(message: string): string | null {
  if (!messageAsksToPlay(message)) return null
  const stripped = message
    .replace(/\b(please|play|hear|put on|listen to)\b/gi, ' ')
    .replace(/[^a-z0-9\s']/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (stripped.length < 2 || /^(it|that|this|one|the one|that one|this one)$/i.test(stripped)) return null
  return stripped
}

export function answerForPlayback(answer: string, action: UiAction | undefined, finishedPlay: boolean): string {
  if (action?.type !== 'playSong') return answer
  const where = action.year ? ` from ${action.year}` : ''
  const playing = `Playing "${action.title}" by ${action.artist}${where}.`
  const missing = `The archive has "${action.title}" by ${action.artist}${where}, but there is no recording to play.`
  const deniesRecording = /no recording|cannot play|can't play|could not find a recording/i.test(answer)
  if (action.videoId) {
    if (finishedPlay || !answer.trim() || deniesRecording) return playing
    return answer
  }
  if (finishedPlay || !answer.trim() || !deniesRecording) return missing
  return answer
}

export function parseToolArgs(name: string, raw: unknown): { ok: true; data: unknown } | { ok: false; error: string } {
  const schema = argumentSchemas[name as keyof typeof argumentSchemas]
  if (!schema) return { ok: false, error: `Unknown tool "${name}"` }
  const parsed = schema.safeParse(raw ?? {})
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'args'}: ${issue.message}`).join('; ') }
  }
  return { ok: true, data: parsed.data }
}

export async function executeTool(
  db: PrismaClient,
  name: string,
  raw: unknown,
  ctx: ToolContext,
  writer: PrismaClient | null = null,
): Promise<unknown> {
  const parsed = parseToolArgs(name, raw)
  if (!parsed.ok) return { error: parsed.error }

  if (name === 'get_chart') {
    const args = parsed.data as z.infer<typeof argumentSchemas.get_chart>
    const chart = await getChart(db, args.genre, args.year)
    if (!chart) return { error: `Unknown genre "${args.genre}"` }
    return chart
  }

  if (name === 'search_songs') {
    const args = parsed.data as z.infer<typeof argumentSchemas.search_songs>
    if (!args.text && !args.artist && !args.genre && args.year_from == null && args.year_to == null) {
      return { error: 'Provide text, artist, genre, or a year range.' }
    }
    const results = await searchSongs(db, {
      text: args.text,
      artist: args.artist,
      genre: args.genre,
      yearFrom: args.year_from,
      yearTo: args.year_to,
      rankMax: args.rank_max,
      limit: args.limit ?? 20,
    })
    ctx.lastSearch = results
    return {
      results,
      note: 'These rows do not say if a recording exists. To play one, call set_ui_action playSong with its songId.',
    }
  }

  if (name === 'artist_history') {
    const args = parsed.data as z.infer<typeof argumentSchemas.artist_history>
    const matches = await findArtistsByName(db, args.artist_name)
    if (matches.length === 0) return { matches: [], appearances: [], note: 'No artist matched that name.' }
    const history = await getArtistHistory(db, matches[0].id)
    return {
      matched: matches[0],
      alternatives: matches.slice(1),
      appearances: history?.appearances ?? [],
    }
  }

  if (name === 'compare_years') {
    const args = parsed.data as z.infer<typeof argumentSchemas.compare_years>
    return compareYears(db, args.genre, args.year_a, args.year_b)
  }

  if (name === 'coverage') {
    const args = parsed.data as z.infer<typeof argumentSchemas.coverage>
    const rows = await listCoverage(db)
    const filtered = args.genre ? rows.filter((row) => row.genreSlug === args.genre) : rows
    if (args.genre && filtered.length === 0) return { error: `Unknown genre "${args.genre}"` }
    const withCharts = filtered.filter((row) => row.entryCount > 0)
    return {
      yearsWithCharts: withCharts.map((row) => ({
        genreSlug: row.genreSlug,
        year: row.year,
        entryCount: row.entryCount,
        isOfficial: row.isOfficial,
      })),
      emptyYears: filtered.filter((row) => row.entryCount === 0).length,
      chartsOnRecord: withCharts.length,
    }
  }

  if (name === 'create_playlist' || name === 'add_to_playlist' || name === 'random_playlist') {
    if (!writer) return { error: 'Playlist edits are not available.' }
    if (name === 'create_playlist') {
      const args = parsed.data as z.infer<typeof argumentSchemas.create_playlist>
      const result = await createMixPlaylist(writer, args.name)
      if ('error' in result) return { error: result.error }
      ctx.action = { type: 'showPlaylist', playlistId: result.playlist.id }
      return {
        playlist: { id: result.playlist.id, name: result.playlist.name, entryCount: 0 },
        note: 'Empty playlist, opened on screen. Add songs with add_to_playlist using ids from search_songs or get_chart.',
      }
    }
    if (name === 'add_to_playlist') {
      const args = parsed.data as z.infer<typeof argumentSchemas.add_to_playlist>
      const target = await findMixPlaylist(writer, { playlistId: args.playlist_id, name: args.name })
      if ('error' in target) return { error: target.error }
      const result = await addSongsToPlaylist(writer, target.id, args.song_ids)
      if ('error' in result) return { error: result.error }
      ctx.action = { type: 'showPlaylist', playlistId: result.playlist.id }
      return {
        playlist: { id: result.playlist.id, name: result.playlist.name, entryCount: result.playlist.entryCount },
        added: result.added.map((song) => ({ songId: song.songId, title: song.title, artist: song.artist })),
        alreadyOnPlaylist: result.alreadyOnPlaylist,
      }
    }
    const args = parsed.data as z.infer<typeof argumentSchemas.random_playlist>
    const result = await createRandomPlaylist(writer, {
      name: args.name,
      genres: args.genres,
      count: args.count ?? 12,
    })
    if ('error' in result) return { error: result.error }
    ctx.action = { type: 'showPlaylist', playlistId: result.playlist.id }
    return {
      playlist: { id: result.playlist.id, name: result.playlist.name, entryCount: result.playlist.entryCount },
      songs: result.songs.map((song) => ({ songId: song.songId, title: song.title, artist: song.artist })),
      note: result.playlist.note,
    }
  }

  if (name === 'set_ui_action') {
    const args = parsed.data as z.infer<typeof argumentSchemas.set_ui_action>
    if (args.type === 'showChart') {
      const chart = await getChart(db, args.genre, args.year)
      if (!chart) return { error: `Unknown genre "${args.genre}"` }
      ctx.action = { type: 'showChart', genre: chart.genre.slug, year: args.year, rank: ctx.rank }
      return { ok: true, action: ctx.action }
    }
    if (args.type === 'showResults') {
      if (!ctx.lastSearch) return { error: 'No search results to show. Call search_songs first.' }
      ctx.action = { type: 'showResults', results: ctx.lastSearch }
      return { ok: true, count: ctx.lastSearch.length }
    }
    if (args.type === 'scrollToRank') {
      ctx.rank = args.rank
      if (ctx.action?.type === 'showChart') {
        ctx.action = { ...ctx.action, rank: args.rank }
      } else {
        ctx.action = { type: 'scrollToRank', rank: args.rank }
      }
      return { ok: true, action: ctx.action }
    }
    if (args.type === 'playSong') {
      const song = await getSongDetail(db, args.songId)
      if (!song) return { error: `No song with id ${args.songId}` }
      const best = [...song.appearances].sort((a, b) => a.rank - b.rank || b.year - a.year)[0]
      ctx.action = {
        type: 'playSong',
        songId: song.song.id,
        title: song.song.title,
        artist: song.song.artist.name,
        videoId: song.song.youtubeVideoId,
        ...(best ? { genre: best.genreSlug, year: best.year, rank: best.rank } : {}),
      }
      return { ok: true, action: ctx.action, hasRecording: Boolean(song.song.youtubeVideoId) }
    }
    if (args.artistId) {
      const history = await getArtistHistory(db, args.artistId)
      if (!history) return { error: `No artist with id ${args.artistId}` }
      ctx.action = { type: 'showArtist', artistId: history.artist.id }
      return { ok: true, action: ctx.action, name: history.artist.name }
    }
    if (args.artistName) {
      const matches = await findArtistsByName(db, args.artistName)
      if (matches.length === 0) return { error: `No artist matched "${args.artistName}"` }
      ctx.action = { type: 'showArtist', artistId: matches[0].id }
      return { ok: true, action: ctx.action, name: matches[0].name }
    }
    return { error: 'showArtist needs artistId or artistName' }
  }

  return { error: `Unknown tool "${name}"` }
}
