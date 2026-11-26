import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { normalize } from './normalize.js'

const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/

type Recording = {
  title: string
  artist: string
  youtubeVideoId: string
}

export function readRecordings(): Recording[] {
  const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'recordings.json')
  if (!existsSync(path)) return []
  const rows = JSON.parse(readFileSync(path, 'utf8')) as Recording[]
  return rows.filter((row) => VIDEO_ID.test(row.youtubeVideoId))
}

/** Fill songs that have no video yet. A corrected id is left alone. */
export async function linkRecordings(prisma: PrismaClient): Promise<number> {
  let linked = 0
  for (const row of readRecordings()) {
    const artist = await prisma.artist.findUnique({ where: { nameNormalized: normalize(row.artist) } })
    if (!artist) continue
    const song = await prisma.song.findUnique({
      where: {
        titleNormalized_primaryArtistId: {
          titleNormalized: normalize(row.title),
          primaryArtistId: artist.id,
        },
      },
    })
    if (!song || song.youtubeVideoId) continue
    await prisma.song.update({ where: { id: song.id }, data: { youtubeVideoId: row.youtubeVideoId } })
    linked += 1
  }
  return linked
}
