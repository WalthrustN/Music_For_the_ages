import type { PrismaClient } from '@prisma/client'
import { normalize } from './normalize.js'

const NOTE = 'A listening list, not a chart. These are influential soul records released this year. Positions are listening order. Years with fewer than 20 songs are not padded.'

/** Proto-soul begins in 1950 with Clyde McPhatter. Years before that stay empty. */
export const SOUL_LISTENING: { year: number; songs: { title: string; artist: string }[] }[] = [
  { year: 1950, songs: [{ title: 'Do Something for Me', artist: 'The Dominoes' }] },
  { year: 1951, songs: [{ title: 'I Am with You', artist: 'The Dominoes' }] },
  { year: 1952, songs: [
    { title: "That's What You're Doing to Me", artist: 'The Dominoes' },
    { title: 'Have Mercy Baby', artist: 'The Dominoes' },
    { title: "I'd Be Satisfied", artist: 'Billy Ward and His Dominoes' },
    { title: "Baby Don't Do It", artist: 'The "5" Royales' },
    { title: 'The Bells', artist: 'Billy Ward and His Dominoes' },
  ] },
  { year: 1953, songs: [
    { title: 'Help Me Somebody', artist: 'The "5" Royales' },
    { title: 'Crazy, Crazy, Crazy', artist: 'The "5" Royales' },
    { title: 'These Foolish Things', artist: 'Billy Ward and His Dominoes' },
    { title: "Too Much Lovin' (Much Too Much)", artist: 'The "5" Royales' },
    { title: 'Money Honey', artist: 'Clyde McPhatter and the Drifters' },
  ] },
  { year: 1954, songs: [
    { title: 'I Do', artist: 'The "5" Royales' },
    { title: 'Lucille', artist: 'Clyde McPhatter and the Drifters' },
    { title: 'Such a Night', artist: 'Clyde McPhatter and the Drifters' },
    { title: 'Honey Love', artist: 'Clyde McPhatter and the Drifters' },
    { title: 'Bip Bam', artist: 'Clyde McPhatter and the Drifters' },
    { title: 'White Christmas', artist: 'Clyde McPhatter and the Drifters' },
    { title: 'I Got a Woman', artist: 'Ray Charles' },
  ] },
  { year: 1955, songs: [
    { title: "What'cha Gonna Do", artist: 'Clyde McPhatter and the Drifters' },
    { title: 'A Fool for You', artist: 'Ray Charles' },
    { title: 'This Little Girl of Mine', artist: 'Ray Charles' },
    { title: 'Love Has Joined Us Together', artist: 'Clyde McPhatter and Ruth Brown' },
    { title: 'Seven Days', artist: 'Clyde McPhatter' },
  ] },
  { year: 1956, songs: [
    { title: 'Please, Please, Please', artist: 'James Brown and the Famous Flames' },
    { title: 'Treasure of Love', artist: 'Clyde McPhatter' },
    { title: 'Hallelujah I Love Her So', artist: 'Ray Charles' },
    { title: 'Without Love (There Is Nothing)', artist: 'Clyde McPhatter' },
  ] },
  { year: 1957, songs: [
    { title: 'Just to Hold My Hand', artist: 'Clyde McPhatter' },
    { title: 'Tears of Joy', artist: 'The "5" Royales' },
    { title: 'Think', artist: 'The "5" Royales' },
    { title: 'Long Lonely Nights', artist: 'Clyde McPhatter' },
    { title: 'You Send Me', artist: 'Sam Cooke' },
  ] },
  { year: 1958, songs: [
    { title: 'Come What May', artist: 'Clyde McPhatter' },
    { title: "A Lover's Question", artist: 'Clyde McPhatter' },
    { title: 'Lonely Teardrops', artist: 'Jackie Wilson' },
  ] },
  { year: 1959, songs: [
    { title: "What'd I Say", artist: 'Ray Charles' },
    { title: 'Shout', artist: 'The Isley Brothers' },
  ] },
  { year: 1960, songs: [
    { title: 'Chain Gang', artist: 'Sam Cooke' },
    { title: 'Ta Ta', artist: 'Clyde McPhatter' },
  ] },
  { year: 1961, songs: [{ title: 'Stand By Me', artist: 'Ben E. King' }] },
  { year: 1962, songs: [
    { title: 'Green Onions', artist: "Booker T. and the M.G.'s" },
    { title: 'Bring It On Home to Me', artist: 'Sam Cooke' },
    { title: 'Cry to Me', artist: 'Solomon Burke' },
    { title: 'Lover Please', artist: 'Clyde McPhatter' },
  ] },
  { year: 1963, songs: [
    { title: 'Heat Wave', artist: 'Martha and the Vandellas' },
    { title: 'Cry Baby', artist: 'Garnet Mimms and the Enchanters' },
    { title: 'Deep in the Heart of Harlem', artist: 'Clyde McPhatter' },
  ] },
  { year: 1964, songs: [
    { title: 'A Change Is Gonna Come', artist: 'Sam Cooke' },
    { title: 'My Guy', artist: 'Mary Wells' },
    { title: 'Where Did Our Love Go', artist: 'The Supremes' },
  ] },
  { year: 1965, songs: [
    { title: 'My Girl', artist: 'The Temptations' },
    { title: "I Can't Help Myself", artist: 'The Four Tops' },
    { title: 'Papa\'s Got a Brand New Bag', artist: 'James Brown' },
    { title: 'In the Midnight Hour', artist: 'Wilson Pickett' },
    { title: "I've Been Loving You Too Long", artist: 'Otis Redding' },
    { title: 'Shotgun', artist: 'Jr. Walker and the All Stars' },
    { title: 'The Tracks of My Tears', artist: 'The Miracles' },
    { title: 'Stop! In the Name of Love', artist: 'The Supremes' },
  ] },
  { year: 1966, songs: [
    { title: 'When a Man Loves a Woman', artist: 'Percy Sledge' },
    { title: "Hold On, I'm Comin'", artist: 'Sam and Dave' },
    { title: "It's a Man's Man's Man's World", artist: 'James Brown' },
    { title: 'Try a Little Tenderness', artist: 'Otis Redding' },
    { title: 'You Can\'t Hurry Love', artist: 'The Supremes' },
    { title: 'Reach Out I\'ll Be There', artist: 'The Four Tops' },
    { title: 'Knock on Wood', artist: 'Eddie Floyd' },
    { title: '634-5789', artist: 'Wilson Pickett' },
  ] },
  { year: 1967, songs: [
    { title: 'I Never Loved a Man (The Way I Love You)', artist: 'Aretha Franklin' },
    { title: 'Respect', artist: 'Aretha Franklin' },
    { title: 'Baby I Love You', artist: 'Aretha Franklin' },
    { title: '(You Make Me Feel Like) A Natural Woman', artist: 'Aretha Franklin' },
    { title: 'Chain of Fools', artist: 'Aretha Franklin' },
    { title: 'Soul Man', artist: 'Sam and Dave' },
    { title: 'Sweet Soul Music', artist: 'Arthur Conley' },
    { title: 'Funky Broadway', artist: 'Wilson Pickett' },
    { title: 'Cold Sweat', artist: 'James Brown' },
    { title: 'Soul Finger', artist: 'The Bar-Kays' },
    { title: 'I Heard It Through the Grapevine', artist: 'Gladys Knight and the Pips' },
    { title: 'I Second That Emotion', artist: 'Smokey Robinson and the Miracles' },
    { title: '(Your Love Keeps Lifting Me) Higher and Higher', artist: 'Jackie Wilson' },
    { title: 'Tramp', artist: 'Otis Redding and Carla Thomas' },
    { title: "Ain't No Mountain High Enough", artist: 'Marvin Gaye and Tammi Terrell' },
    { title: 'I Was Made to Love Her', artist: 'Stevie Wonder' },
  ] },
  { year: 1968, songs: [
    { title: "(Sittin' On) The Dock of the Bay", artist: 'Otis Redding' },
    { title: 'Think', artist: 'Aretha Franklin' },
    { title: 'I Heard It Through the Grapevine', artist: 'Marvin Gaye' },
    { title: 'I Wish It Would Rain', artist: 'The Temptations' },
    { title: 'Say It Loud – I\'m Black and I\'m Proud', artist: 'James Brown' },
    { title: '(Sweet Sweet Baby) Since You\'ve Been Gone', artist: 'Aretha Franklin' },
    { title: 'Tighten Up', artist: 'Archie Bell and the Drells' },
    { title: 'I Thank You', artist: 'Sam and Dave' },
    { title: 'Who\'s Making Love', artist: 'Johnnie Taylor' },
    { title: 'Dance to the Music', artist: 'Sly and the Family Stone' },
  ] },
]

export async function seedSoulListening(prisma: PrismaClient): Promise<void> {
  const genre = await prisma.genre.findUnique({ where: { slug: 'soul' } })
  if (!genre) throw new Error('Soul genre is missing')

  for (const yearList of SOUL_LISTENING) {
    const songIds: number[] = []
    for (const item of yearList.songs) {
      const nameNormalized = normalize(item.artist)
      const artist = await prisma.artist.upsert({
        where: { nameNormalized },
        create: { name: item.artist, nameNormalized },
        update: {},
      })
      const titleNormalized = normalize(item.title)
      const existing = await prisma.song.findUnique({
        where: { titleNormalized_primaryArtistId: { titleNormalized, primaryArtistId: artist.id } },
      })
      const song = existing
        ? await prisma.song.update({
          where: { id: existing.id },
          data: { releaseYear: existing.releaseYear ?? yearList.year },
        })
        : await prisma.song.create({
          data: {
            title: item.title,
            titleNormalized,
            primaryArtistId: artist.id,
            releaseYear: yearList.year,
          },
        })
      await prisma.songGenre.createMany({
        data: [{ songId: song.id, genreId: genre.id }],
        skipDuplicates: true,
      })
      songIds.push(song.id)
    }

    const existingList = await prisma.playlist.findFirst({
      where: { genreId: genre.id, year: yearList.year, kind: 'dj', name: 'Influential soul' },
    })
    const playlist = existingList
      ? await prisma.playlist.update({
        where: { id: existingList.id },
        data: { note: NOTE },
      })
      : await prisma.playlist.create({
        data: {
          genreId: genre.id,
          year: yearList.year,
          name: 'Influential soul',
          kind: 'dj',
          note: NOTE,
        },
      })

    await prisma.playlistEntry.deleteMany({ where: { playlistId: playlist.id } })
    await prisma.playlistEntry.createMany({
      data: songIds.map((songId, index) => ({
        playlistId: playlist.id,
        songId,
        position: index + 1,
      })),
    })
  }
  console.log(`Seeded influential soul lists for ${SOUL_LISTENING.length} years. Proto-soul begins in 1950.`)
}
