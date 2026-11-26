import type { PrismaClient } from '@prisma/client'
import { normalize } from '../normalize.js'
import { assertYear, parseCsv, type RowError } from './parse.js'

export type ImportInput = {
  csvText: string
  genreSlug: string
  year: number
  sourceName: string
  sourceUrl?: string | null
  isOfficial: boolean
  methodologyNote?: string | null
}

export type ImportSuccess = {
  ok: true
  genreSlug: string
  year: number
  sourceName: string
  isOfficial: boolean
  entries: number
}

export type ImportFailure = {
  ok: false
  errors: RowError[]
}

export async function importChart(
  prisma: PrismaClient,
  input: ImportInput,
): Promise<ImportSuccess | ImportFailure> {
  const parsed = parseCsv(input.csvText)
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  const yearError = assertYear(input.year)
  if (yearError) return { ok: false, errors: [{ row: 0, message: yearError }] }
  if (!input.sourceName.trim()) {
    return { ok: false, errors: [{ row: 0, message: 'source name is required' }] }
  }
  if (!input.genreSlug.trim()) {
    return { ok: false, errors: [{ row: 0, message: 'genre is required' }] }
  }

  const genre = await prisma.genre.findUnique({ where: { slug: input.genreSlug } })
  if (!genre) {
    return { ok: false, errors: [{ row: 0, message: `Unknown genre "${input.genreSlug}"` }] }
  }

  const artistNames = new Map<string, string>()
  for (const row of parsed.rows) {
    const key = normalize(row.artist)
    if (!artistNames.has(key)) artistNames.set(key, row.artist)
  }

  await prisma.$transaction(async (tx) => {
    const artistIds = new Map<string, number>()
    for (const [key, name] of artistNames) {
      const artist = await tx.artist.upsert({
        where: { nameNormalized: key },
        create: { name, nameNormalized: key },
        update: {},
      })
      artistIds.set(key, artist.id)
    }

    const songIds: { rank: number; songId: number }[] = []
    for (const row of parsed.rows) {
      const titleNormalized = normalize(row.title)
      const artistId = artistIds.get(normalize(row.artist))
      if (!artistId) throw new Error(`Missing artist id for ${row.artist}`)
      const song = await tx.song.upsert({
        where: {
          titleNormalized_primaryArtistId: {
            titleNormalized,
            primaryArtistId: artistId,
          },
        },
        create: {
          title: row.title,
          titleNormalized,
          primaryArtistId: artistId,
          featuredArtists: row.featuredArtists,
          releaseYear: row.releaseYear,
        },
        update: {
          featuredArtists: row.featuredArtists,
          releaseYear: row.releaseYear,
        },
      })
      songIds.push({ rank: row.rank, songId: song.id })
    }

    await tx.songGenre.createMany({
      data: songIds.map((entry) => ({ songId: entry.songId, genreId: genre.id })),
      skipDuplicates: true,
    })

    const sourceName = input.sourceName.trim()
    const chart = await tx.chart.upsert({
      where: { year_genreId_sourceName: { year: input.year, genreId: genre.id, sourceName } },
      create: {
        year: input.year,
        genreId: genre.id,
        name: sourceName,
        sourceName,
        sourceUrl: input.sourceUrl?.trim() || null,
        isOfficial: input.isOfficial,
        methodologyNote: input.methodologyNote ?? null,
      },
      update: {
        name: sourceName,
        sourceUrl: input.sourceUrl?.trim() || null,
        isOfficial: input.isOfficial,
        methodologyNote: input.methodologyNote ?? null,
      },
    })

    await tx.chartEntry.deleteMany({ where: { chartId: chart.id } })
    await tx.chartEntry.createMany({
      data: songIds.map((entry) => ({
        chartId: chart.id,
        rank: entry.rank,
        songId: entry.songId,
      })),
    })
  }, { timeout: 60_000 })

  return {
    ok: true,
    genreSlug: input.genreSlug,
    year: input.year,
    sourceName: input.sourceName.trim(),
    isOfficial: input.isOfficial,
    entries: parsed.rows.length,
  }
}
