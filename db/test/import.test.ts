import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'
import { importChart } from '../src/import/commit.js'
import { parseCsv } from '../src/import/parse.js'
import { normalize } from '../src/normalize.js'

const prisma = new PrismaClient()

function csv(rows: string[]): string {
  return ['rank,title,artist,featured_artists,release_year', ...rows].join('\n')
}

describe('normalize', () => {
  it('folds case, punctuation, and spacing', () => {
    expect(normalize("  Don’t   Stop!! ")).toBe('dont stop')
  })
})

describe('parseCsv', () => {
  it('accepts the example files', () => {
    for (const name of ['rnb_1965.csv', 'jazz_1958.csv', 'soul_1972.csv']) {
      const text = readFileSync(resolve(import.meta.dirname, '../data', name), 'utf8')
      const parsed = parseCsv(text)
      expect(parsed.ok, name).toBe(true)
    }
  })

  it('reports every problem and does not return rows', () => {
    const parsed = parseCsv(
      csv([
        '0,Mock Song 1,Mock Artist A,,1960',
        '2,,Mock Artist A,,',
        '2,Mock Song 2,,,',
        '3,Mock Song 1,Mock Artist A,,',
        '101,Mock Song 9,Mock Artist B,,',
      ]),
    )
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    const messages = parsed.errors.map((error) => error.message).join(' | ')
    expect(messages).toMatch(/outside 1/)
    expect(messages).toMatch(/title is required/)
    expect(messages).toMatch(/duplicate rank 2/)
    expect(messages).toMatch(/artist is required/)
    expect(messages).toMatch(/duplicate song/)
    expect(messages).toMatch(/outside 1–100/)
  })

  it('rejects a missing header', () => {
    const parsed = parseCsv('rank,title\n1,Mock Song 1\n')
    expect(parsed.ok).toBe(false)
  })
})

describe('importChart', () => {
  it('does not touch the database when validation fails', async () => {
    const prismaStub = {
      genre: { findUnique: () => Promise.reject(new Error('should not read')) },
      $transaction: () => Promise.reject(new Error('should not write')),
    } as unknown as PrismaClient

    const result = await importChart(prismaStub, {
      csvText: csv(['1,,Mock Artist A,,']),
      genreSlug: 'rnb',
      year: 2099,
      sourceName: 'Should not write',
      isOfficial: false,
    })
    expect(result.ok).toBe(false)
  })

  it('replaces a chart in one transaction and leaves it unchanged after a bad file', async () => {
    const good = csv([
      '1,Import Test Song 1,Import Test Artist,,2098',
      '2,Import Test Song 2,Import Test Artist,,2098',
    ])
    const created = await importChart(prisma, {
      csvText: good,
      genreSlug: 'rnb',
      year: 2098,
      sourceName: 'Import test list',
      sourceUrl: 'https://example.com/import-test',
      isOfficial: true,
    })
    expect(created.ok).toBe(true)

    const before = await prisma.chart.findFirstOrThrow({
      where: { year: 2098, genre: { slug: 'rnb' } },
      include: { entries: true },
    })
    expect(before.entries).toHaveLength(2)
    expect(before.isOfficial).toBe(true)

    const rejected = await importChart(prisma, {
      csvText: csv(['1,Import Test Song 1,Import Test Artist,,', '1,Import Test Song 3,Import Test Artist,,']),
      genreSlug: 'rnb',
      year: 2098,
      sourceName: 'Broken replacement',
      isOfficial: false,
    })
    expect(rejected.ok).toBe(false)

    const after = await prisma.chart.findFirstOrThrow({
      where: { id: before.id },
      include: { entries: true },
    })
    expect(after.sourceName).toBe('Import test list')
    expect(after.isOfficial).toBe(true)
    expect(after.entries).toHaveLength(2)

    const replaced = await importChart(prisma, {
      csvText: csv(['4,Import Test Song 9,Import Test Artist,,2097']),
      genreSlug: 'rnb',
      year: 2098,
      sourceName: 'Import test list replaced',
      isOfficial: false,
    })
    expect(replaced.ok).toBe(true)
    const next = await prisma.chart.findFirstOrThrow({
      where: { id: before.id },
      include: { entries: { include: { song: true } } },
    })
    expect(next.entries).toHaveLength(1)
    expect(next.entries[0]?.rank).toBe(4)
    expect(next.entries[0]?.song.title).toBe('Import Test Song 9')
    expect(next.isOfficial).toBe(false)
  })
})

afterAll(async () => {
  await prisma.chart.deleteMany({ where: { year: 2098 } })
  await prisma.song.deleteMany({ where: { title: { startsWith: 'Import Test Song' } } })
  await prisma.artist.deleteMany({ where: { name: 'Import Test Artist' } })
  await prisma.$disconnect()
})
