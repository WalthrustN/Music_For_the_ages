import { Prisma, type PrismaClient } from '@prisma/client'

type Failure = { status: number; error: string }

export type PlaylistSong = {
  songId: number
  title: string
  artist: string
  releaseYear: number | null
  youtubeVideoId: string | null
}

export type MixPlaylist = {
  id: number
  name: string
  note: string | null
  entryCount: number
  entries: {
    position: number
    song: {
      id: number
      title: string
      featuredArtists: string | null
      releaseYear: number | null
      youtubeVideoId: string | null
    }
    artist: { id: number; name: string }
  }[]
}

const playlistInclude = {
  entries: {
    orderBy: { position: 'asc' as const },
    include: { song: { include: { primaryArtist: true } } },
  },
}

type PlaylistRow = Prisma.PlaylistGetPayload<{ include: typeof playlistInclude }>

function toMix(playlist: PlaylistRow): MixPlaylist {
  return {
    id: playlist.id,
    name: playlist.name,
    note: playlist.note,
    entryCount: playlist.entries.length,
    entries: playlist.entries.map((entry) => ({
      position: entry.position,
      song: {
        id: entry.song.id,
        title: entry.song.title,
        featuredArtists: entry.song.featuredArtists,
        releaseYear: entry.song.releaseYear,
        youtubeVideoId: entry.song.youtubeVideoId,
      },
      artist: { id: entry.song.primaryArtist.id, name: entry.song.primaryArtist.name },
    })),
  }
}

function toSongs(playlist: MixPlaylist): PlaylistSong[] {
  return playlist.entries.map((entry) => ({
    songId: entry.song.id,
    title: entry.song.title,
    artist: entry.artist.name,
    releaseYear: entry.song.releaseYear,
    youtubeVideoId: entry.song.youtubeVideoId,
  }))
}

async function loadMix(db: PrismaClient, id: number): Promise<MixPlaylist | null> {
  const playlist = await db.playlist.findUnique({ where: { id }, include: playlistInclude })
  if (!playlist || playlist.kind !== 'mix') return null
  return toMix(playlist)
}

export async function listMixPlaylists(db: PrismaClient): Promise<MixPlaylist[]> {
  const playlists = await db.playlist.findMany({
    where: { kind: 'mix' },
    orderBy: { updatedAt: 'desc' },
    include: playlistInclude,
  })
  return playlists.map(toMix)
}

export async function createMixPlaylist(
  db: PrismaClient,
  name: string,
): Promise<{ playlist: MixPlaylist } | Failure> {
  const playlist = await db.playlist.create({
    data: { name, kind: 'mix' },
    include: playlistInclude,
  })
  return { playlist: toMix(playlist) }
}

export async function deleteMixPlaylist(
  db: PrismaClient,
  playlistId: number,
): Promise<{ ok: true } | Failure> {
  const playlist = await db.playlist.findUnique({ where: { id: playlistId } })
  if (!playlist || playlist.kind !== 'mix') return { status: 404, error: 'Playlist not found' }
  await db.playlist.delete({ where: { id: playlistId } })
  return { ok: true }
}

export async function addSongsToPlaylist(
  db: PrismaClient,
  playlistId: number,
  songIds: number[],
): Promise<{ playlist: MixPlaylist; added: PlaylistSong[]; alreadyOnPlaylist: number } | Failure> {
  const playlist = await db.playlist.findUnique({ where: { id: playlistId } })
  if (!playlist || playlist.kind !== 'mix') return { status: 404, error: 'Playlist not found' }

  const uniqueIds = [...new Set(songIds)]
  const songs = await db.song.findMany({ where: { id: { in: uniqueIds } } })
  const found = new Set(songs.map((song) => song.id))
  const missing = uniqueIds.find((id) => !found.has(id))
  if (missing != null) return { status: 404, error: `No song with id ${missing}` }

  const existing = await db.playlistEntry.findMany({
    where: { playlistId, songId: { in: uniqueIds } },
    select: { songId: true },
  })
  const already = new Set(existing.map((entry) => entry.songId))
  const toAdd = uniqueIds.filter((id) => !already.has(id))
  if (toAdd.length === 0) return { status: 409, error: 'Those songs are already on this playlist.' }

  const last = await db.playlistEntry.aggregate({ where: { playlistId }, _max: { position: true } })
  let position = last._max.position ?? 0
  await db.playlistEntry.createMany({
    data: toAdd.map((songId) => ({ playlistId, songId, position: ++position })),
  })
  await db.playlist.update({ where: { id: playlistId }, data: { updatedAt: new Date() } })

  const loaded = await loadMix(db, playlistId)
  if (!loaded) return { status: 404, error: 'Playlist not found' }
  const addedIds = new Set(toAdd)
  return {
    playlist: loaded,
    added: toSongs(loaded).filter((song) => addedIds.has(song.songId)),
    alreadyOnPlaylist: already.size,
  }
}

export async function removeSongFromPlaylist(
  db: PrismaClient,
  playlistId: number,
  songId: number,
): Promise<{ playlist: MixPlaylist } | Failure> {
  const playlist = await db.playlist.findUnique({ where: { id: playlistId } })
  if (!playlist || playlist.kind !== 'mix') return { status: 404, error: 'Playlist not found' }
  const entry = await db.playlistEntry.findUnique({
    where: { playlistId_songId: { playlistId, songId } },
  })
  if (!entry) return { status: 404, error: 'That song is not on this playlist.' }
  await db.playlistEntry.delete({ where: { id: entry.id } })
  await db.playlist.update({ where: { id: playlistId }, data: { updatedAt: new Date() } })
  const loaded = await loadMix(db, playlistId)
  if (!loaded) return { status: 404, error: 'Playlist not found' }
  return { playlist: loaded }
}

export async function createRandomPlaylist(
  db: PrismaClient,
  input: { name?: string; genres: string[]; count: number },
): Promise<{ playlist: MixPlaylist; songs: PlaylistSong[] } | Failure> {
  const catalog = await db.genre.findMany()
  const bySlug = new Map(catalog.map((genre) => [genre.slug.toLowerCase(), genre]))
  const matched: typeof catalog = []
  const missing: string[] = []
  for (const slug of input.genres) {
    const genre = bySlug.get(slug.trim().toLowerCase())
    if (!genre) missing.push(slug.trim())
    else if (!matched.some((item) => item.id === genre.id)) matched.push(genre)
  }
  if (missing.length > 0) return { status: 400, error: `Unknown genre "${missing[0]}"` }
  if (matched.length === 0) return { status: 400, error: 'Name at least one genre.' }

  const ids = matched.map((genre) => genre.id)
  const rows = await db.$queryRaw<{ id: number }[]>`
    SELECT s.id
    FROM songs s
    WHERE EXISTS (
      SELECT 1
      FROM chart_entries ce
      INNER JOIN charts c ON c.id = ce.chart_id
      WHERE ce.song_id = s.id
        AND c.genre_id IN (${Prisma.join(ids)})
    )
    ORDER BY random()
    LIMIT ${input.count}
  `
  if (rows.length === 0) {
    const names = matched.map((genre) => genre.name).join(', ')
    return { status: 404, error: `The archive has no songs charted in ${names}.` }
  }

  const note = `Random from ${matched.map((genre) => genre.name).join(', ')}`
  const playlist = await db.playlist.create({
    data: {
      name: input.name?.trim() || matched.map((genre) => genre.name).join(', '),
      kind: 'mix',
      note,
      entries: {
        create: rows.map((row, index) => ({ songId: row.id, position: index + 1 })),
      },
    },
    include: playlistInclude,
  })
  const mix = toMix(playlist)
  return { playlist: mix, songs: toSongs(mix) }
}

export async function findMixPlaylist(
  db: PrismaClient,
  input: { playlistId?: number; name?: string },
): Promise<{ id: number; name: string } | Failure> {
  if (input.playlistId) {
    const playlist = await db.playlist.findUnique({ where: { id: input.playlistId } })
    if (!playlist || playlist.kind !== 'mix') return { status: 404, error: 'Playlist not found' }
    return { id: playlist.id, name: playlist.name }
  }
  if (input.name) {
    const playlist = await db.playlist.findFirst({
      where: { kind: 'mix', name: { equals: input.name, mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' },
    })
    if (!playlist) return { status: 404, error: `No playlist named "${input.name}". Call create_playlist first.` }
    return { id: playlist.id, name: playlist.name }
  }
  return { status: 400, error: 'Provide playlist_id or name.' }
}
