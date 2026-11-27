export type Genre = {
  id: number
  slug: string
  name: string
  parentId: number | null
  sortOrder: number
}

export type CoverageCell = {
  genreSlug: string
  year: number
  entryCount: number
  isOfficial: boolean | null
}

export type ChartSong = {
  bestRank: number
  song: {
    id: number
    title: string
    featuredArtists: string | null
    releaseYear: number | null
    youtubeVideoId: string | null
  }
  artist: { id: number; name: string }
  charts: { chartId: number; name: string; sourceName: string; rank: number; isOfficial: boolean }[]
}

export type YearChart = {
  id: number
  year: number
  name: string
  sourceName: string
  sourceUrl: string | null
  isOfficial: boolean
  methodologyNote: string | null
  entryCount: number
  updatedAt: string
}

export type PlaylistSong = {
  position: number
  song: ChartSong['song']
  artist: { id: number; name: string }
}

export type YearPlaylist = {
  id: number
  name: string
  kind: string
  note: string | null
  entryCount: number
  entries: PlaylistSong[]
}

export type ChartPayload = {
  genre: Genre
  charts: YearChart[]
  songs: ChartSong[]
  playlists: YearPlaylist[]
}

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

export type Appearance = {
  rank: number
  songId: number
  songTitle: string
  releaseYear: number | null
  year: number
  genreSlug: string
  genreName: string
  chartId: number
  isOfficial: boolean
  sourceName: string
}

export type SongDetail = {
  song: {
    id: number
    title: string
    featuredArtists: string | null
    releaseYear: number | null
    artist: { id: number; name: string }
    youtubeVideoId: string | null
  }
  appearances: Appearance[]
  artistAppearances: Appearance[]
}

export type ArtistHistory = {
  artist: { id: number; name: string }
  appearances: Appearance[]
}

export type MixPlaylist = {
  id: number
  name: string
  note: string | null
  entryCount: number
  entries: PlaylistSong[]
}

export type UiAction =
  | { type: 'showChart'; genre: string; year: number; rank?: number }
  | { type: 'showResults'; results: SearchHit[] }
  | { type: 'scrollToRank'; rank: number }
  | { type: 'showArtist'; artistId: number }
  | {
      type: 'playSong'
      songId: number
      title: string
      artist: string
      videoId: string | null
      genre?: string
      year?: number
      rank?: number
    }
  | { type: 'showPlaylist'; playlistId: number }

export type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
  results?: SearchHit[]
}
