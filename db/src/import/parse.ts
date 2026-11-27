import { parse } from 'csv-parse/sync'
import { normalize, YEAR_MAX, YEAR_MIN } from '../normalize.js'

export type CsvRow = {
  row: number
  rank: number
  title: string
  artist: string
  featuredArtists: string | null
  releaseYear: number | null
}

export type RowError = {
  row: number
  message: string
}

const REQUIRED_COLUMNS = ['rank', 'title', 'artist', 'featured_artists', 'release_year'] as const

export function parseCsv(csvText: string): { ok: true; rows: CsvRow[] } | { ok: false; errors: RowError[] } {
  let records: Record<string, string>[]
  try {
    records = parse(csvText, {
      columns: (header: string[]) => header.map((column) => column.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: false,
    }) as Record<string, string>[]
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not parse CSV'
    return { ok: false, errors: [{ row: 1, message }] }
  }

  if (records.length === 0) {
    return { ok: false, errors: [{ row: 1, message: 'CSV has no data rows' }] }
  }

  const headerKeys = Object.keys(records[0] ?? {})
  const missing = REQUIRED_COLUMNS.filter((column) => !headerKeys.includes(column))
  if (missing.length > 0) {
    return {
      ok: false,
      errors: [{ row: 1, message: `Missing columns: ${missing.join(', ')}` }],
    }
  }

  const errors: RowError[] = []
  const rows: CsvRow[] = []
  const ranks = new Set<number>()
  const songs = new Set<string>()

  records.forEach((record, index) => {
    const row = index + 2
    const rankText = record.rank ?? ''
    const title = record.title ?? ''
    const artist = record.artist ?? ''
    const featured = (record.featured_artists ?? '').trim()
    const releaseText = (record.release_year ?? '').trim()

    if (!/^\d+$/.test(rankText)) {
      errors.push({ row, message: `rank "${rankText}" is not a whole number` })
    }
    const rank = Number(rankText)
    if (/^\d+$/.test(rankText) && rank < 1) {
      errors.push({ row, message: `rank ${rank} must be 1 or greater` })
    } else if (/^\d+$/.test(rankText) && ranks.has(rank)) {
      errors.push({ row, message: `duplicate rank ${rank}` })
    } else if (/^\d+$/.test(rankText)) {
      ranks.add(rank)
    }

    if (!title.trim()) errors.push({ row, message: 'title is required' })
    if (!artist.trim()) errors.push({ row, message: 'artist is required' })

    const titleNormalized = title.trim() ? normalize(title) : ''
    const artistNormalized = artist.trim() ? normalize(artist) : ''
    if (title.trim() && !titleNormalized) errors.push({ row, message: 'title has no letters or digits' })
    if (artist.trim() && !artistNormalized) errors.push({ row, message: 'artist has no letters or digits' })

    if (titleNormalized && artistNormalized) {
      const key = `${titleNormalized}::${artistNormalized}`
      if (songs.has(key)) {
        errors.push({ row, message: `duplicate song "${title.trim()}" by "${artist.trim()}"` })
      } else {
        songs.add(key)
      }
    }

    let releaseYear: number | null = null
    if (releaseText) {
      if (!/^\d+$/.test(releaseText)) {
        errors.push({ row, message: `release_year "${releaseText}" is not a whole number` })
      } else {
        releaseYear = Number(releaseText)
        if (releaseYear < 1800 || releaseYear > YEAR_MAX) {
          errors.push({ row, message: `release_year ${releaseYear} is outside 1800–${YEAR_MAX}` })
        }
      }
    }

    if (errors.some((error) => error.row === row)) return

    rows.push({
      row,
      rank,
      title: title.trim(),
      artist: artist.trim(),
      featuredArtists: featured || null,
      releaseYear,
    })
  })

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, rows }
}

export function assertYear(year: number): string | null {
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) {
    return `year ${year} is outside ${YEAR_MIN}–${YEAR_MAX}`
  }
  return null
}
