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

export type ChartEntry = {
  rank: number
  song: {
    id: number
    title: string
    featuredArtists: string | null
    releaseYear: number | null
  }
  artist: { id: number; name: string }
}

export type ChartPayload = {
  genre: Genre
  chart: {
    id: number
    year: number
    sourceName: string
    sourceUrl: string | null
    isOfficial: boolean
    methodologyNote: string | null
    entryCount: number
    updatedAt: string
  } | null
  entries: ChartEntry[]
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
  }
  appearances: Appearance[]
  artistAppearances: Appearance[]
}

export type ArtistHistory = {
  artist: { id: number; name: string }
  appearances: Appearance[]
}

export type UiAction =
  | { type: 'showChart'; genre: string; year: number; rank?: number }
  | { type: 'showResults'; results: SearchHit[] }
  | { type: 'scrollToRank'; rank: number }
  | { type: 'showArtist'; artistId: number }

export type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
  results?: SearchHit[]
}
