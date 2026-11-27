import { PrismaClient } from '@prisma/client'
import { loadEnv } from '../src/env.js'
import { GENRES } from '../src/genres.js'
import { normalize } from '../src/normalize.js'
import { linkRecordings } from '../src/recordings.js'
import { seedSoulListening } from '../src/soul-listening.js'

loadEnv()

const ARTISTS = ['Mock Artist A', 'Mock Artist B', 'Mock Artist C'] as const

const MOCK_NOTE = 'Synthetic mock data for development. These are not real chart rankings.'

type MockChart = {
  genre: string
  year: number
  count: number
  official: boolean
  url?: string
}

const MOCK_CHARTS: MockChart[] = [
  { genre: 'jazz', year: 1972, count: 60, official: true },
  { genre: 'jazz', year: 1980, count: 100, official: false },
  // 1991 is intentionally missing so coverage shows 0 entries.
  { genre: 'jazz', year: 2004, count: 100, official: true },
  { genre: 'jazz', year: 2016, count: 40, official: false },
  { genre: 'blues', year: 1972, count: 100, official: false },
  { genre: 'blues', year: 1980, count: 25, official: true },
  { genre: 'blues', year: 1991, count: 100, official: false },
  { genre: 'blues', year: 2004, count: 100, official: true },
  { genre: 'blues', year: 2016, count: 100, official: false },
]

function songNumber(genre: string, year: number, rank: number, count: number): number {
  if (count >= 100) return rank
  const shift = (year + genre.length * 3) % 50
  return ((shift + rank - 1) % 100) + 1
}

async function main(): Promise<void> {
  const prisma = new PrismaClient()
  try {
    await prisma.$transaction(async (tx) => {
      for (const genre of GENRES) {
        await tx.genre.upsert({
          where: { slug: genre.slug },
          create: { slug: genre.slug, name: genre.name, sortOrder: genre.sortOrder },
          update: { name: genre.name, sortOrder: genre.sortOrder },
        })
      }

      const artistIds = new Map<string, number>()
      for (const name of ARTISTS) {
        const nameNormalized = normalize(name)
        const artist = await tx.artist.upsert({
          where: { nameNormalized },
          create: { name, nameNormalized },
          update: { name },
        })
        artistIds.set(name, artist.id)
      }

      const songIds = new Map<number, number>()
      for (let n = 1; n <= 100; n += 1) {
        const title = `Mock Song ${n}`
        const artistName = ARTISTS[(n - 1) % ARTISTS.length]
        const featuredName = n % 11 === 0 ? ARTISTS[n % ARTISTS.length] : null
        const featuredArtists = featuredName && featuredName !== artistName ? featuredName : null
        const releaseYear = n % 10 === 0 ? null : 1950 + (n % 60)
        const song = await tx.song.upsert({
          where: {
            titleNormalized_primaryArtistId: {
              titleNormalized: normalize(title),
              primaryArtistId: artistIds.get(artistName)!,
            },
          },
          create: {
            title,
            titleNormalized: normalize(title),
            primaryArtistId: artistIds.get(artistName)!,
            featuredArtists,
            releaseYear,
          },
          update: { featuredArtists, releaseYear },
        })
        songIds.set(n, song.id)
      }

      const genreRows = await tx.genre.findMany()
      const genreIdBySlug = new Map(genreRows.map((genre) => [genre.slug, genre.id]))

      for (const mock of MOCK_CHARTS) {
        const genreId = genreIdBySlug.get(mock.genre)
        if (!genreId) throw new Error(`Missing genre ${mock.genre}`)
        const genreName = GENRES.find((genre) => genre.slug === mock.genre)?.name ?? mock.genre
        const sourceName = `Mock ${genreName} year-end list`
        const chart = await tx.chart.upsert({
          where: { year_genreId_sourceName: { year: mock.year, genreId, sourceName } },
          create: {
            year: mock.year,
            genreId,
            name: sourceName,
            sourceName,
            sourceUrl: mock.url ?? null,
            isOfficial: mock.official,
            methodologyNote: MOCK_NOTE,
          },
          update: {
            name: sourceName,
            sourceUrl: mock.url ?? null,
            isOfficial: mock.official,
            methodologyNote: MOCK_NOTE,
          },
        })
        await tx.chartEntry.deleteMany({ where: { chartId: chart.id } })
        const used = new Set<number>()
        const data = []
        for (let rank = 1; rank <= mock.count; rank += 1) {
          let n = songNumber(mock.genre, mock.year, rank, mock.count)
          if (used.has(n)) n = ((n + 49) % 100) + 1
          used.add(n)
          const songId = songIds.get(n)
          if (!songId) throw new Error(`Missing mock song ${n}`)
          data.push({ chartId: chart.id, rank, songId })
        }
        await tx.chartEntry.createMany({ data })
        await tx.songGenre.createMany({
          data: data.map((row) => ({ songId: row.songId, genreId })),
          skipDuplicates: true,
        })
      }

      await tx.chart.deleteMany({
        where: { year: 1965, genre: { slug: { in: ['blues', 'jazz'] } }, sourceName: { startsWith: 'Mock' } },
      })
      await tx.chart.deleteMany({
        where: { genre: { slug: 'soul' }, sourceName: { startsWith: 'Mock' } },
      })
      await tx.songGenre.deleteMany({
        where: { genre: { slug: 'soul' }, song: { title: { startsWith: 'Mock Song ' } } },
      })
    }, { timeout: 120_000 })
    console.log(`Seeded ${GENRES.length} genres and ${MOCK_CHARTS.length} mock charts.`)
    console.log('Jazz 1991 has no chart on purpose.')
    await seedSoulListening(prisma)
    const linked = await linkRecordings(prisma)
    console.log(`Linked ${linked} songs that had no recording yet.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
