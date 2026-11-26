import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import {
  compareYears,
  findArtistsByName,
  getArtistHistory,
  getChart,
  listCoverage,
  searchSongs,
  type SearchHit,
} from '../queries.js'
import type { ToolDefinition } from './types.js'

const year = z.number().int().min(1925).max(2100)

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
  set_ui_action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('showChart'), genre: z.string().min(1), year }),
    z.object({ type: z.literal('showResults') }),
    z.object({ type: z.literal('scrollToRank'), rank: z.number().int().min(1).max(100) }),
    z.object({
      type: z.literal('showArtist'),
      artistId: z.number().int().positive().optional(),
      artistName: z.string().min(1).optional(),
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
    name: 'set_ui_action',
    description: 'Ask the screen to show a chart, the last search, a rank, or an artist. This does not query the database except to resolve an artist name.',
    parameters: objectSchema({
      type: { type: 'string', enum: ['showChart', 'showResults', 'scrollToRank', 'showArtist'] },
      genre: { type: 'string' },
      year: { type: 'integer' },
      rank: { type: 'integer' },
      artistId: { type: 'integer' },
      artistName: { type: 'string' },
    }, ['type']),
  },
]

export type UiAction =
  | { type: 'showChart'; genre: string; year: number; rank?: number }
  | { type: 'showResults'; results: SearchHit[] }
  | { type: 'scrollToRank'; rank: number }
  | { type: 'showArtist'; artistId: number }

export type ToolContext = {
  lastSearch: SearchHit[] | null
  action?: UiAction
  rank?: number
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
    return { results }
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
