export const GENRES = [
  { slug: 'soul', name: 'Soul', sortOrder: 10 },
  { slug: 'blues', name: 'Blues', sortOrder: 20 },
  { slug: 'ragtime', name: 'Ragtime', sortOrder: 25 },
  { slug: 'jazz', name: 'Jazz', sortOrder: 30 },
  { slug: 'rap-hip-hop', name: 'Rap/Hip-Hop', sortOrder: 40 },
  { slug: 'rnb', name: 'R&B', sortOrder: 50 },
  { slug: 'reggae-dancehall', name: 'Reggae/Dancehall', sortOrder: 60 },
  { slug: 'kompa', name: 'Kompa/Haitian', sortOrder: 70 },
  { slug: 'japanese', name: 'Japanese', sortOrder: 80 },
  { slug: 'british-soul', name: 'British Soul', sortOrder: 90 },
  { slug: 'afrobeats', name: 'Afrobeats', sortOrder: 100 },
  { slug: 'gospel', name: 'Gospel', sortOrder: 110 },
  { slug: 'classical', name: 'Classical', sortOrder: 120 },
  { slug: 'country', name: 'Country', sortOrder: 130 },
  { slug: 'latin', name: 'Latin', sortOrder: 140 },
] as const

export type GenreSlug = (typeof GENRES)[number]['slug']
