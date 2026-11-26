import type { PrismaClient } from '@prisma/client'
import { normalize } from '@chart-archive/db'

type Failure = { status: number; error: string }

export async function createPlaylist(
  db: PrismaClient,
  input: { genre: string; year: number; name: string },
): Promise<{ playlist: { id: number; name: string; year: number; kind: string } } | Failure> {
  const genre = await db.genre.findUnique({ where: { slug: input.genre } })
  if (!genre) return { status: 404, error: `Unknown genre "${input.genre}"` }
  const playlist = await db.playlist.create({
    data: { genreId: genre.id, year: input.year, name: input.name, kind: 'saved' },
  })
  return { playlist: { id: playlist.id, name: playlist.name, year: playlist.year, kind: playlist.kind } }
}

export async function addSongToPlaylist(
  db: PrismaClient,
  playlistId: number,
  input: { songId?: number; title?: string; artist?: string },
): Promise<{ position: number; songId: number } | Failure> {
  const playlist = await db.playlist.findUnique({ where: { id: playlistId } })
  if (!playlist) return { status: 404, error: 'List not found' }

  let songId: number
  if (input.songId) {
    const song = await db.song.findUnique({
      where: { id: input.songId },
      include: { genres: true },
    })
    if (!song) return { status: 404, error: 'Song not found' }
    if (song.releaseYear !== playlist.year) {
      return { status: 400, error: `A list for ${playlist.year} can only hold songs from ${playlist.year}.` }
    }
    if (!song.genres.some((link) => link.genreId === playlist.genreId)) {
      return { status: 400, error: 'That song is not filed under this genre.' }
    }
    songId = song.id
  } else if (input.title && input.artist) {
    const created = await findOrCreateYearSong(db, playlist.genreId, playlist.year, input.title, input.artist)
    if ('error' in created) return created
    songId = created.songId
  } else {
    return { status: 400, error: 'Provide a song from this year, or a title and artist.' }
  }

  const existing = await db.playlistEntry.findUnique({
    where: { playlistId_songId: { playlistId, songId } },
  })
  if (existing) return { status: 409, error: 'That song is already on this list.' }

  const last = await db.playlistEntry.aggregate({ where: { playlistId }, _max: { position: true } })
  const position = (last._max.position ?? 0) + 1
  await db.playlistEntry.create({ data: { playlistId, songId, position } })
  return { position, songId }
}

async function findOrCreateYearSong(
  db: PrismaClient,
  genreId: number,
  year: number,
  title: string,
  artistName: string,
): Promise<{ songId: number } | Failure> {
  const nameNormalized = normalize(artistName)
  const titleNormalized = normalize(title)
  if (!nameNormalized || !titleNormalized) {
    return { status: 400, error: 'Title and artist need letters or digits.' }
  }
  const artist = await db.artist.upsert({
    where: { nameNormalized },
    create: { name: artistName.trim(), nameNormalized },
    update: {},
  })
  const existing = await db.song.findUnique({
    where: { titleNormalized_primaryArtistId: { titleNormalized, primaryArtistId: artist.id } },
  })
  if (existing?.releaseYear != null && existing.releaseYear !== year) {
    return { status: 400, error: `${existing.title} is already on record for ${existing.releaseYear}.` }
  }
  const song = existing
    ? await db.song.update({ where: { id: existing.id }, data: { releaseYear: existing.releaseYear ?? year } })
    : await db.song.create({
      data: {
        title: title.trim(),
        titleNormalized,
        primaryArtistId: artist.id,
        releaseYear: year,
      },
    })
  await db.songGenre.createMany({ data: [{ songId: song.id, genreId }], skipDuplicates: true })
  return { songId: song.id }
}
