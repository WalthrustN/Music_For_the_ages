import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Appearance } from '../types'
import { parseYouTubeVideoId, thumbnailUrl } from '../youtube'

function AppearanceList({
  rows,
  onOpen,
}: {
  rows: Appearance[]
  onOpen: (row: Appearance) => void
}) {
  if (rows.length === 0) return <p className="text-sm text-stone-400">No chart appearances on record.</p>
  return (
    <ul className="space-y-1">
      {rows.map((row) => (
        <li key={`${row.chartId}-${row.songId}-${row.rank}`}>
          <button
            type="button"
            className="flex w-full items-baseline justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/10"
            onClick={() => onOpen(row)}
          >
            <span>
              <span className="text-gold tabular-nums">#{row.rank}</span>{' '}
              <span className="font-serif">{row.songTitle}</span>
              <span className="block text-xs text-stone-400">{row.genreName} · {row.sourceName}</span>
            </span>
            <span className="text-sm text-stone-300">{row.year}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function Drawer({
  songId,
  artistId,
  onClose,
  onOpenArtist,
  onOpenChart,
  onPlay,
}: {
  songId: number | null
  artistId: number | null
  onClose: () => void
  onOpenArtist: (id: number) => void
  onOpenChart: (genre: string, year: number, rank: number) => void
  onPlay: (song: { songId: number; title: string; artist: string; videoId: string | null }) => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const open = songId != null || artistId != null
  const song = useQuery({
    queryKey: ['song', songId],
    queryFn: () => api.song(songId!),
    enabled: songId != null,
  })
  const artist = useQuery({
    queryKey: ['artist', artistId],
    queryFn: () => api.artist(artistId!),
    enabled: artistId != null && songId == null,
  })

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const title = song.data?.song.title ?? artist.data?.artist.name ?? 'Details'
  const loading = song.isLoading || artist.isLoading
  const failed = song.isError || artist.isError

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Close details" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="panel-blur relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/15 bg-neutral-950/90 p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="drawer-title" className="font-serif text-3xl text-ivory">{loading ? 'Loading…' : title}</h2>
          <button ref={closeRef} type="button" className="rounded-full border border-white/20 px-3 py-1 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        {failed ? (
          <p className="mt-4 text-rose-200" role="alert">{(song.error as Error | null)?.message || (artist.error as Error | null)?.message}</p>
        ) : null}
        {song.data ? (
          <div className="mt-4 space-y-6">
            <p className="text-stone-200">
              <button type="button" className="underline decoration-white/30" onClick={() => onOpenArtist(song.data.song.artist.id)}>
                {song.data.song.artist.name}
              </button>
              {song.data.song.featuredArtists ? ` with ${song.data.song.featuredArtists}` : ''}
              {song.data.song.releaseYear ? ` · ${song.data.song.releaseYear}` : ''}
            </p>
            <RecordingForm
              songId={song.data.song.id}
              title={song.data.song.title}
              artist={song.data.song.artist.name}
              videoId={song.data.song.youtubeVideoId}
              onPlay={onPlay}
            />
            <section>
              <h3 className="mb-2 text-sm uppercase tracking-[0.16em] text-gold">This song</h3>
              <AppearanceList
                rows={song.data.appearances}
                onOpen={(row) => onOpenChart(row.genreSlug, row.year, row.rank)}
              />
            </section>
            <section>
              <h3 className="mb-2 text-sm uppercase tracking-[0.16em] text-gold">{song.data.song.artist.name}</h3>
              <AppearanceList
                rows={song.data.artistAppearances}
                onOpen={(row) => onOpenChart(row.genreSlug, row.year, row.rank)}
              />
            </section>
          </div>
        ) : null}
        {artist.data ? (
          <div className="mt-4">
            <h3 className="mb-2 text-sm uppercase tracking-[0.16em] text-gold">Chart appearances</h3>
            <AppearanceList
              rows={artist.data.appearances}
              onOpen={(row) => onOpenChart(row.genreSlug, row.year, row.rank)}
            />
          </div>
        ) : null}
      </aside>
    </div>
  )
}

function RecordingForm({
  songId,
  title,
  artist,
  videoId,
  onPlay,
}: {
  songId: number
  title: string
  artist: string
  videoId: string | null
  onPlay: (song: { songId: number; title: string; artist: string; videoId: string | null }) => void
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(videoId ?? '')
    setLocalError(null)
  }, [songId, videoId])

  const save = useMutation({
    mutationFn: (next: string | null) => api.setRecording(songId, next),
    onSuccess: async (result) => {
      setLocalError(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['song', songId] }),
        queryClient.invalidateQueries({ queryKey: ['chart'] }),
      ])
      onPlay({ songId, title, artist, videoId: result.youtubeVideoId })
    },
  })

  function submit(next: string | null) {
    if (next === null) {
      setLocalError(null)
      save.mutate(null)
      return
    }
    const parsed = parseYouTubeVideoId(next)
    if (!parsed) {
      setLocalError('Paste a YouTube link or an 11-character video id.')
      return
    }
    setLocalError(null)
    save.mutate(parsed)
  }

  return (
    <section>
      <h3 className="mb-2 text-sm uppercase tracking-[0.16em] text-gold">Recording</h3>
      {videoId ? (
        <button
          type="button"
          className="mb-3 flex items-center gap-3 text-left"
          onClick={() => onPlay({ songId, title, artist, videoId })}
        >
          <img src={thumbnailUrl(videoId)} alt="" className="h-12 w-20 rounded-md object-cover" />
          <span className="text-sm text-ivory">Play this recording</span>
        </button>
      ) : (
        <p className="mb-3 text-sm text-stone-300">No YouTube recording is linked yet.</p>
      )}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          submit(draft)
        }}
      >
        <label className="block text-sm" htmlFor="recording-link">YouTube link</label>
        <input
          id="recording-link"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-ivory"
        />
        <p className="text-xs text-stone-400">The picture is YouTube’s thumbnail for that video. Replace the link if the recording is wrong.</p>
        {localError || save.isError ? (
          <p className="text-sm text-rose-200" role="alert">{localError || (save.error as Error).message}</p>
        ) : null}
        <div className="flex gap-2">
          <button type="submit" className="rounded-full bg-amber-100 px-3 py-1.5 text-sm text-neutral-950" disabled={save.isPending}>
            Save link
          </button>
          {videoId ? (
            <button type="button" className="rounded-full border border-white/20 px-3 py-1.5 text-sm" disabled={save.isPending} onClick={() => submit(null)}>
              Clear
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
