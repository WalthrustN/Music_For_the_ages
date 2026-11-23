import { Prisma, type PrismaClient } from '@prisma/client'
import { normalize } from '@chart-archive/db'

export type SearchHit = {
  songId: number
  title: string
  featuredArtists: string | null
  releaseYear: number | null
  artistId: number
  artistName: string
  rank: number
  year: number
  genreSlug: string
  genreName: string
  isOfficial: boolean
}

function publicGenre(genre: { id: number; slug: string; name: string; parentId: number | null; sortOrder: number }) {
  return {
    id: genre.id,
    slug: genre.slug,
    name: genre.name,
    parentId: genre.parentId,
    sortOrder: genre.sortOrder,
  }
}

function appearance(entry: {
  rank: number
  song: { id: number; title: string; releaseYear: number | null }
  chart: {
    id: number
    year: number
    isOfficial: boolean
    sourceName: string
    genre: { slug: string; name: string }
  }
}) {
  return {
    rank: entry.rank,
    songId: entry.song.id,
    songTitle: entry.song.title,
    releaseYear: entry.song.releaseYear,
    year: entry.chart.year,
    genreSlug: entry.chart.genre.slug,
    genreName: entry.chart.genre.name,
    chartId: entry.chart.id,
    isOfficial: entry.chart.isOfficial,
    sourceName: entry.chart.sourceName,
  }
}

export async function listGenres(db: PrismaClient) {
  const genres = await db.genre.findMany({ orderBy: { sortOrder: 'asc' } })
  return genres.map(publicGenre)
}

export async function listCoverage(db: PrismaClient) {
  const [genres, rows] = await Promise.all([
    db.genre.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.chartCoverage.findMany(),
  ])
  const order = new Map(genres.map((genre, index) => [genre.slug, index]))
  return rows
    .map((row) => ({
      genreSlug: row.genreSlug,
      year: row.year,
      entryCount: row.entryCount,
      isOfficial: row.isOfficial,
    }))
    .sort((a, b) => (order.get(a.genreSlug) ?? 0) - (order.get(b.genreSlug) ?? 0) || a.year - b.year)
}

export async function getChart(db: PrismaClient, slug: string, year: number) {
  const genre = await db.genre.findUnique({ where: { slug } })
  if (!genre) return null
  const chart = await db.chart.findUnique({
    where: { year_genreId: { year, genreId: genre.id } },
  })
  if (!chart) {
    return { genre: publicGenre(genre), chart: null, entries: [] as const }
  }
  const entries = await db.chartEntry.findMany({
    where: { chartId: chart.id },
    orderBy: { rank: 'asc' },
    include: { song: { include: { primaryArtist: true } } },
  })
  return {
    genre: publicGenre(genre),
    chart: {
      id: chart.id,
      year: chart.year,
      sourceName: chart.sourceName,
      sourceUrl: chart.sourceUrl,
      isOfficial: chart.isOfficial,
      methodologyNote: chart.methodologyNote,
      entryCount: entries.length,
      updatedAt: chart.updatedAt.toISOString(),
    },
    entries: entries.map((entry) => ({
      rank: entry.rank,
      song: {
        id: entry.song.id,
        title: entry.song.title,
        featuredArtists: entry.song.featuredArtists,
        releaseYear: entry.song.releaseYear,
      },
      artist: { id: entry.song.primaryArtist.id, name: entry.song.primaryArtist.name },
    })),
  }
}

export async function searchSongs(
  db: PrismaClient,
  filters: {
    text?: string
    artist?: string
    genre?: string
    yearFrom?: number
    yearTo?: number
    rankMax?: number
    limit: number
  },
): Promise<SearchHit[]> {
  const text = filters.text ? normalize(filters.text) : ''
  const artist = filters.artist ? normalize(filters.artist) : ''
  const textFilter = text
    ? Prisma.sql`AND (
        s.title_normalized % ${text}
        OR a.name_normalized % ${text}
        OR s.title_normalized ILIKE ${'%' + text + '%'}
        OR a.name_normalized ILIKE ${'%' + text + '%'}
      )`
    : Prisma.empty
  const artistFilter = artist
    ? Prisma.sql`AND (
        a.name_normalized % ${artist}
        OR a.name_normalized ILIKE ${'%' + artist + '%'}
      )`
    : Prisma.empty
  const genreFilter = filters.genre ? Prisma.sql`AND g.slug = ${filters.genre}` : Prisma.empty
  const yearFromFilter = filters.yearFrom != null ? Prisma.sql`AND c.year >= ${filters.yearFrom}` : Prisma.empty
  const yearToFilter = filters.yearTo != null ? Prisma.sql`AND c.year <= ${filters.yearTo}` : Prisma.empty
  const rankFilter = filters.rankMax != null ? Prisma.sql`AND ce.rank <= ${filters.rankMax}` : Prisma.empty

  const rows = await db.$queryRaw<SearchHit[]>(Prisma.sql`
    SELECT
      s.id AS "songId",
      s.title AS title,
      s.featured_artists AS "featuredArtists",
      s.release_year AS "releaseYear",
      a.id AS "artistId",
      a.name AS "artistName",
      ce.rank AS rank,
      c.year AS year,
      g.slug AS "genreSlug",
      g.name AS "genreName",
      c.is_official AS "isOfficial"
    FROM chart_entries ce
    JOIN charts c ON c.id = ce.chart_id
    JOIN songs s ON s.id = ce.song_id
    JOIN artists a ON a.id = s.primary_artist_id
    JOIN genres g ON g.id = c.genre_id
    WHERE TRUE
      ${textFilter}
      ${artistFilter}
      ${genreFilter}
      ${yearFromFilter}
      ${yearToFilter}
      ${rankFilter}
    ORDER BY
      CASE
        WHEN ${text} = '' THEN 0
        ELSE GREATEST(similarity(s.title_normalized, ${text}), similarity(a.name_normalized, ${text}))
      END DESC,
      c.year DESC,
      ce.rank ASC
    LIMIT ${filters.limit}
  `)
  return rows.map((row) => ({
    ...row,
    songId: Number(row.songId),
    artistId: Number(row.artistId),
    rank: Number(row.rank),
    year: Number(row.year),
    releaseYear: row.releaseYear == null ? null : Number(row.releaseYear),
    isOfficial: Boolean(row.isOfficial),
  }))
}

export async function getArtistHistory(db: PrismaClient, id: number) {
  const artist = await db.artist.findUnique({ where: { id } })
  if (!artist) return null
  const entries = await db.chartEntry.findMany({
    where: { song: { primaryArtistId: id } },
    orderBy: [{ chart: { year: 'asc' } }, { rank: 'asc' }],
    include: { song: true, chart: { include: { genre: true } } },
  })
  return {
    artist: { id: artist.id, name: artist.name },
    appearances: entries.map(appearance),
  }
}

export async function findArtistsByName(db: PrismaClient, name: string) {
  const normalized = normalize(name)
  if (!normalized) return []
  const exact = await db.artist.findUnique({ where: { nameNormalized: normalized } })
  if (exact) return [{ id: exact.id, name: exact.name, exact: true }]
  const rows = await db.$queryRaw<{ id: number; name: string }[]>`
    SELECT id, name
    FROM artists
    WHERE name_normalized % ${normalized}
       OR name_normalized ILIKE ${'%' + normalized + '%'}
    ORDER BY similarity(name_normalized, ${normalized}) DESC, name ASC
    LIMIT 5
  `
  return rows.map((row) => ({ id: Number(row.id), name: row.name, exact: false }))
}

export async function getSongDetail(db: PrismaClient, id: number) {
  const song = await db.song.findUnique({
    where: { id },
    include: { primaryArtist: true },
  })
  if (!song) return null
  const [songEntries, artistEntries] = await Promise.all([
    db.chartEntry.findMany({
      where: { songId: id },
      orderBy: [{ chart: { year: 'asc' } }, { rank: 'asc' }],
      include: { song: true, chart: { include: { genre: true } } },
    }),
    db.chartEntry.findMany({
      where: { song: { primaryArtistId: song.primaryArtistId } },
      orderBy: [{ chart: { year: 'asc' } }, { rank: 'asc' }],
      include: { song: true, chart: { include: { genre: true } } },
    }),
  ])
  return {
    song: {
      id: song.id,
      title: song.title,
      featuredArtists: song.featuredArtists,
      releaseYear: song.releaseYear,
      artist: { id: song.primaryArtist.id, name: song.primaryArtist.name },
    },
    appearances: songEntries.map(appearance),
    artistAppearances: artistEntries.map(appearance),
  }
}

export async function compareYears(db: PrismaClient, genre: string, yearA: number, yearB: number) {
  const [left, right] = await Promise.all([getChart(db, genre, yearA), getChart(db, genre, yearB)])
  if (!left || !right) return { error: `Unknown genre "${genre}"` }
  const missing = [left.chart ? null : yearA, right.chart ? null : yearB].filter((year): year is number => year != null)
  if (missing.length > 0 || !left.chart || !right.chart) {
    return {
      genre,
      yearA,
      yearB,
      missing,
      common: [],
      added: [],
      note: 'One or both charts are missing from the archive. Nothing below was guessed.',
    }
  }
  const bySong = new Map(left.entries.map((entry) => [entry.song.id, entry]))
  const common = []
  const added = []
  for (const entry of right.entries) {
    const previous = bySong.get(entry.song.id)
    if (previous) {
      common.push({
        songId: entry.song.id,
        title: entry.song.title,
        artistName: entry.artist.name,
        rankA: previous.rank,
        rankB: entry.rank,
      })
    } else {
      added.push({
        songId: entry.song.id,
        title: entry.song.title,
        artistName: entry.artist.name,
        rank: entry.rank,
      })
    }
  }
  return { genre, yearA, yearB, missing: [], common, added }
}
