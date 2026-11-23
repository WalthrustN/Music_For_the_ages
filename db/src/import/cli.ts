import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { loadEnv } from '../env.js'
import { YEAR_MAX, YEAR_MIN } from '../normalize.js'
import { importChart, type ImportFailure } from './commit.js'

loadEnv()

const FILE_NAME = /^([a-z0-9]+(?:-[a-z0-9]+)*)_(\d{4})\.csv$/i

function repoRoot(): string {
  return resolve(import.meta.dirname, '../../..')
}

export function resolveDataPath(input: string): string {
  const direct = resolve(process.cwd(), input)
  if (existsSync(direct)) return direct
  const fromDb = resolve(repoRoot(), 'db', input)
  if (existsSync(fromDb)) return fromDb
  return direct
}

function printErrors(label: string, result: ImportFailure): void {
  console.error(`Import failed for ${label}. No rows from this file were written.`)
  for (const error of result.errors) {
    const where = error.row > 0 ? `Row ${error.row}` : 'File'
    console.error(`  ${where}: ${error.message}`)
  }
}

function printUsage(): void {
  console.log(`Usage:
  npm run import -- --file data/rnb_1965.csv --genre rnb --year 1965 --source "..." --official true --url "..."
  npm run import -- --dir data/

CSV columns: rank,title,artist,featured_artists,release_year
Bulk files must be named {genre}_{year}.csv.`)
}

function parseOfficial(value: string | undefined, fallback: boolean | null): boolean | null {
  if (value == null || value === '') return fallback
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return null
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      dir: { type: 'string' },
      genre: { type: 'string' },
      year: { type: 'string' },
      source: { type: 'string' },
      official: { type: 'string' },
      url: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help || (!values.file && !values.dir)) {
    printUsage()
    process.exit(values.help ? 0 : 1)
  }
  if (values.file && values.dir) {
    console.error('Pass either --file or --dir, not both.')
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }

  const prisma = new PrismaClient()
  let failed = 0
  try {
    if (values.file) {
      if (!values.genre || !values.year || !values.source) {
        console.error('--file requires --genre, --year, and --source.')
        process.exit(1)
      }
      const official = parseOfficial(values.official, null)
      if (official == null) {
        console.error('--official must be true or false.')
        process.exit(1)
      }
      const year = Number(values.year)
      const path = resolveDataPath(values.file)
      const csvText = readFileSync(path, 'utf8')
      const result = await importChart(prisma, {
        csvText,
        genreSlug: values.genre,
        year,
        sourceName: values.source,
        sourceUrl: values.url ?? null,
        isOfficial: official,
      })
      if (!result.ok) {
        printErrors(path, result)
        process.exit(1)
      }
      console.log(
        `Imported ${result.genreSlug} ${result.year}: ${result.entries} songs (${result.isOfficial ? 'official' : 'compiled'}).`,
      )
      console.log(`  source: ${result.sourceName}`)
      return
    }

    const dir = resolveDataPath(values.dir!)
    if (!existsSync(dir)) {
      console.error(`Directory not found: ${dir}`)
      process.exit(1)
    }
    const official = parseOfficial(values.official, false)
    if (official == null) {
      console.error('--official must be true or false.')
      process.exit(1)
    }
    const files = readdirSync(dir)
      .filter((name) => FILE_NAME.test(name))
      .sort()
    if (files.length === 0) {
      console.error(`No {genre}_{year}.csv files in ${dir}`)
      process.exit(1)
    }
    for (const name of files) {
      const match = FILE_NAME.exec(name)
      if (!match) continue
      const genreSlug = match[1].toLowerCase()
      const year = Number(match[2])
      if (year < YEAR_MIN || year > YEAR_MAX) {
        console.error(`${name}: year ${year} is outside ${YEAR_MIN}–${YEAR_MAX}. Nothing written for this file.`)
        failed += 1
        continue
      }
      const path = resolve(dir, name)
      const result = await importChart(prisma, {
        csvText: readFileSync(path, 'utf8'),
        genreSlug,
        year,
        sourceName: values.source?.trim() || `Imported from ${basename(name)}`,
        sourceUrl: values.url ?? null,
        isOfficial: official,
      })
      if (!result.ok) {
        printErrors(name, result)
        failed += 1
        continue
      }
      console.log(`Imported ${result.genreSlug} ${result.year}: ${result.entries} songs.`)
    }
  } finally {
    await prisma.$disconnect()
  }
  if (failed > 0) process.exit(1)
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (import.meta.url === entry) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
