import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../api'
import { usePlaylists } from '../hooks/usePlaylists'
import type { Genre, SearchHit } from '../types'

export type PendingSong = { songId: number; title: string }

export function PlaylistMenu({
  open,
  onOpenChange,
  activeId,
  onActiveId,
  genres,
  pending,
  onPendingHandled,
  notice,
  onPlay,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeId: number | null
  onActiveId: (id: number | null) => void
  genres: Genre[]
  pending: PendingSong | null
  onPendingHandled: () => void
  notice: string | null
  onPlay: (song: { songId: number; title: string; artist: string; videoId: string | null }) => void
}) {
  const panelId = useId()
  const sent = useRef<string | null>(null)
  const { query, create, add, remove, random, removeList } = usePlaylists()
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [count, setCount] = useState(12)
  const [songQuery, setSongQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [confirming, setConfirming] = useState(false)
  const playlists = query.data?.playlists ?? []
  const active = playlists.find((list) => list.id === activeId) ?? null

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(songQuery.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [songQuery])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  useEffect(() => {
    setConfirming(false)
  }, [activeId])

  const pendingKey = pending && active ? `${active.id}:${pending.songId}` : null
  useEffect(() => {
    if (!pendingKey || !pending || !active) {
      sent.current = null
      return
    }
    if (sent.current === pendingKey) return
    sent.current = pendingKey
    add.mutate(
      { id: active.id, songIds: [pending.songId] },
      { onSettled: () => onPendingHandled() },
    )
  }, [pendingKey, pending, active, add, onPendingHandled])

  const search = useQuery({
    queryKey: ['playlist-search', debounced],
    queryFn: () => api.search({ q: debounced, limit: 6 }),
    enabled: open && debounced.length > 0 && active != null,
  })

  const seen = new Set<number>()
  const hits = (search.data?.results ?? []).filter((hit) => {
    if (seen.has(hit.songId)) return false
    seen.add(hit.songId)
    return true
  })

  const message = notice
    || (create.error as Error | null)?.message
    || (add.error as Error | null)?.message
    || (random.error as Error | null)?.message
    || (remove.error as Error | null)?.message
    || (removeList.error as Error | null)?.message
    || (query.error as Error | null)?.message
    || null

  function choose(id: number) {
    onActiveId(id)
    setSongQuery('')
  }

  function addHit(hit: SearchHit) {
    if (!active || add.isPending) return
    add.mutate(
      { id: active.id, songIds: [hit.songId] },
      { onSuccess: () => setSongQuery('') },
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        className={`max-w-36 truncate rounded-full border px-3 py-1.5 text-sm ${
          open || active
            ? 'border-amber-100 bg-amber-100 text-neutral-950'
            : 'border-white/20 bg-black/50 text-ivory hover:bg-black/70'
        }`}
      >
        {active ? active.name : 'Playlist'}
      </button>
      {open ? (
        <div
          id={panelId}
          className="scroll-thin absolute left-0 top-12 z-40 max-h-[min(32rem,calc(100dvh-6rem))] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-white/15 bg-neutral-950/95 p-3 shadow-2xl"
        >
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const next = name.trim()
              if (!next || create.isPending) return
              create.mutate(next, {
                onSuccess: (result) => {
                  setName('')
                  onActiveId(result.playlist.id)
                },
              })
            }}
          >
            <label htmlFor="playlist-name" className="sr-only">New playlist</label>
            <input
              id="playlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New playlist"
              className="min-w-0 flex-1 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-sm text-ivory"
            />
            <button type="submit" className="rounded-full bg-amber-100 px-3 py-1.5 text-sm text-neutral-950">New</button>
          </form>

          {playlists.length > 0 ? (
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="playlist-pick" className="sr-only">Choose a playlist</label>
              <select
                id="playlist-pick"
                value={active?.id ?? ''}
                onChange={(event) => choose(Number(event.target.value))}
                className="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/40 px-2 py-1.5 text-sm text-ivory"
              >
                <option value="" disabled>Choose a playlist</option>
                {playlists.map((list) => (
                  <option key={list.id} value={list.id}>{list.name} ({list.entryCount})</option>
                ))}
              </select>
              {active ? (
                <button
                  type="button"
                  className="shrink-0 text-xs text-stone-300 underline decoration-white/30"
                  onClick={() => {
                    if (!confirming) {
                      setConfirming(true)
                      return
                    }
                    removeList.mutate(active.id, { onSuccess: () => onActiveId(null) })
                  }}
                >
                  {confirming ? 'Confirm' : 'Delete'}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-stone-400">Save a playlist, then add songs from the chart or the archive.</p>
          )}

          {pending && !active ? (
            <p className="mt-2 text-xs text-gold">“{pending.title}” is waiting for a playlist.</p>
          ) : null}
          {active?.note ? <p className="mt-2 truncate text-xs text-stone-400">{active.note}</p> : null}

          {active ? (
            <>
              <label htmlFor="playlist-song" className="sr-only">Search the archive to add a song</label>
              <input
                id="playlist-song"
                value={songQuery}
                onChange={(event) => setSongQuery(event.target.value)}
                placeholder="Add a song from the archive"
                className="mt-2 w-full rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-sm text-ivory placeholder:text-stone-400"
              />
              {debounced.length > 0 ? (
                <ul className="mt-1 max-h-28 overflow-y-auto rounded-xl bg-white/5" aria-label="Songs to add">
                  {search.isFetching ? <li className="px-2 py-1.5 text-xs text-stone-300">Searching…</li> : null}
                  {!search.isFetching && hits.length === 0 ? <li className="px-2 py-1.5 text-xs text-stone-300">No songs match.</li> : null}
                  {hits.map((hit) => (
                    <li key={hit.songId}>
                      <button
                        type="button"
                        className="block w-full truncate px-2 py-1.5 text-left text-sm hover:bg-white/10"
                        onClick={() => addHit(hit)}
                      >
                        {hit.title} <span className="text-stone-400">· {hit.artistName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="mt-2 max-h-36 space-y-0.5 overflow-y-auto" aria-label={`${active.name} songs`}>
                {active.entries.length === 0 ? <li className="text-xs text-stone-400">Nothing on this playlist yet.</li> : null}
                {active.entries.map((entry) => (
                  <li key={entry.song.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm text-ivory hover:text-gold"
                      onClick={() => onPlay({
                        songId: entry.song.id,
                        title: entry.song.title,
                        artist: entry.artist.name,
                        videoId: entry.song.youtubeVideoId,
                      })}
                    >
                      {entry.song.title}
                      <span className="text-stone-400"> · {entry.artist.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${entry.song.title}`}
                      className="grid h-6 w-6 shrink-0 place-items-center text-stone-400 hover:text-ivory"
                      onClick={() => remove.mutate({ id: active.id, songId: entry.song.id })}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <fieldset className="mt-3 border-t border-white/10 pt-3">
            <legend className="text-xs uppercase tracking-[0.16em] text-gold">Random from the archive</legend>
            <div className="mt-2 flex flex-wrap gap-1">
              {genres.map((genre) => {
                const selected = picked.includes(genre.slug)
                return (
                  <button
                    key={genre.slug}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPicked((current) => (
                      selected ? current.filter((slug) => slug !== genre.slug) : [...current, genre.slug]
                    ))}
                    className={`rounded-full px-2 py-1 text-xs ${
                      selected ? 'bg-amber-100 text-neutral-950' : 'bg-white/10 text-ivory'
                    }`}
                  >
                    {genre.name}
                  </button>
                )
              })}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="playlist-count" className="text-xs text-stone-300">Songs</label>
              <input
                id="playlist-count"
                type="number"
                min={1}
                max={40}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                className="w-14 rounded-lg border border-white/20 bg-black/40 px-2 py-1 text-sm text-ivory"
              />
              <button
                type="button"
                disabled={picked.length === 0 || random.isPending}
                onClick={() => {
                  const nextCount = Math.min(40, Math.max(1, count || 12))
                  random.mutate(
                    { name: name.trim() || undefined, genres: picked, count: nextCount },
                    {
                      onSuccess: (result) => {
                        setName('')
                        onActiveId(result.playlist.id)
                      },
                    },
                  )
                }}
                className="rounded-full border border-white/20 px-3 py-1 text-sm text-ivory disabled:opacity-40"
              >
                {random.isPending ? 'Drawing…' : 'Make'}
              </button>
            </div>
          </fieldset>
          {message ? <p className="mt-2 text-xs text-rose-200" role="alert">{message}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
