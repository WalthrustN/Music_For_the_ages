import type {
  ArtistHistory,
  ChartPayload,
  ChatTurn,
  CoverageCell,
  Genre,
  MixPlaylist,
  SearchHit,
  SongDetail,
  UiAction,
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`)
  return body as T
}

export const api = {
  genres: () => request<{ genres: Genre[] }>('/api/genres'),
  coverage: () => request<{ coverage: CoverageCell[] }>('/api/coverage'),
  chart: (genre: string, year: number) => request<ChartPayload>(`/api/charts/${encodeURIComponent(genre)}/${year}`),
  search: (params: { q?: string; limit?: number }) => {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.limit) query.set('limit', String(params.limit))
    return request<{ results: SearchHit[] }>(`/api/search?${query.toString()}`)
  },
  song: (id: number) => request<SongDetail>(`/api/songs/${id}`),
  setRecording: (id: number, youtubeVideoId: string | null) => request<{ id: number; youtubeVideoId: string | null }>(`/api/songs/${id}/recording`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ youtubeVideoId }),
  }),
  artist: (id: number) => request<ArtistHistory>(`/api/artists/${id}/history`),
  assistant: (message: string, history: ChatTurn[]) => request<{ answer: string; action?: UiAction }>('/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history.slice(-40).map((turn) => ({ role: turn.role, content: turn.content })),
    }),
  }),
  playlists: () => request<{ playlists: MixPlaylist[] }>('/api/playlists'),
  createPlaylist: (name: string) => request<{ playlist: MixPlaylist }>('/api/playlists', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  }),
  addToPlaylist: (playlistId: number, songIds: number[]) => request<{ playlist: MixPlaylist }>(`/api/playlists/${playlistId}/songs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ songIds }),
  }),
  removeFromPlaylist: (playlistId: number, songId: number) => request<{ playlist: MixPlaylist }>(`/api/playlists/${playlistId}/songs/${songId}`, {
    method: 'DELETE',
  }),
  randomPlaylist: (body: { name?: string; genres: string[]; count?: number }) => request<{ playlist: MixPlaylist }>('/api/playlists/random', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }),
  deletePlaylist: (playlistId: number) => request<{ ok: true }>(`/api/playlists/${playlistId}`, {
    method: 'DELETE',
  }),
}
