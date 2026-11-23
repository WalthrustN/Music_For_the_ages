import type {
  ArtistHistory,
  ChartPayload,
  ChatTurn,
  CoverageCell,
  Genre,
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
  artist: (id: number) => request<ArtistHistory>(`/api/artists/${id}/history`),
  assistant: (message: string, history: ChatTurn[]) => request<{ answer: string; action?: UiAction }>('/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history.slice(-40).map((turn) => ({ role: turn.role, content: turn.content })),
    }),
  }),
}
