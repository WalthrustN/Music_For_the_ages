import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import type { ChartSong, YearPlaylist } from '../types'

export function YearLists({
  genre,
  genreName,
  year,
  playlists,
  charted,
}: {
  genre: string
  genreName: string
  year: number
  playlists: YearPlaylist[]
  charted: ChartSong[]
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [targetId, setTargetId] = useState<number | null>(playlists.find((list) => list.kind === 'saved')?.id ?? null)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['chart', genre, year] })

  const create = useMutation({
    mutationFn: () => api.createPlaylist(genre, year, name.trim()),
    onSuccess: (result) => {
      setName('')
      setTargetId(result.playlist.id)
      setMessage(null)
      refresh()
    },
    onError: (error: Error) => setMessage(error.message),
  })

  const add = useMutation({
    mutationFn: (body: { songId?: number; title?: string; artist?: string }) => {
      if (!targetId) throw new Error('Save a list first.')
      return api.addToPlaylist(targetId, body)
    },
    onSuccess: () => {
      setTitle('')
      setArtist('')
      setMessage(null)
      refresh()
    },
    onError: (error: Error) => setMessage(error.message),
  })

  const eligible = charted.filter((row) => row.song.releaseYear === year)

  return (
    <section className="panel-glass flex max-h-full min-h-0 w-full flex-col gap-3 overflow-y-auto rounded-3xl border border-white/15 p-4 backdrop-blur-xl lg:w-80" aria-labelledby="lists-heading">
      <div>
        <h2 id="lists-heading" className="font-serif text-2xl">Lists for {year}</h2>
        <p className="mt-1 text-sm text-stone-300">A saved song has to be {genreName} from {year}. Chart position is not required. The same song is kept once.</p>
      </div>
      {playlists.map((playlist) => (
        <article key={playlist.id} className="rounded-2xl bg-white/5 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-serif text-lg">{playlist.name}</h3>
            <span className="text-xs uppercase tracking-wide text-gold">{playlist.kind === 'dj' ? 'Listening' : 'Saved'}</span>
          </div>
          {playlist.note ? <p className="mt-1 text-xs text-stone-400">{playlist.note}</p> : null}
          <ol className="mt-2 space-y-1">
            {playlist.entries.map((entry) => (
              <li key={entry.song.id} className="text-sm">
                <span className="text-stone-500 tabular-nums">{entry.position}. </span>
                {entry.song.title}
                <span className="text-stone-400"> · {entry.artist.name}</span>
              </li>
            ))}
          </ol>
        </article>
      ))}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) create.mutate()
        }}
      >
        <label className="block text-sm" htmlFor="list-name">New saved list</label>
        <div className="flex gap-2">
          <input id="list-name" value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-sm" />
          <button type="submit" className="rounded-full bg-amber-100 px-3 py-1.5 text-sm text-neutral-950">Save</button>
        </div>
      </form>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          add.mutate({ title, artist })
        }}
      >
        <label className="block text-sm" htmlFor="list-target">Add a {year} song</label>
        <select
          id="list-target"
          value={targetId ?? ''}
          onChange={(event) => setTargetId(Number(event.target.value))}
          className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-1.5 text-sm"
        >
          <option value="" disabled>Choose a list</option>
          {playlists.filter((list) => list.kind === 'saved').map((list) => (
            <option key={list.id} value={list.id}>{list.name}</option>
          ))}
        </select>
        <input aria-label="Song title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-1.5 text-sm" />
        <input aria-label="Artist" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Artist" className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-1.5 text-sm" />
        <button type="submit" className="rounded-full border border-white/20 px-3 py-1.5 text-sm">Add</button>
      </form>
      {eligible.length > 0 && targetId ? (
        <div>
          <p className="text-sm text-stone-300">Charted songs from {year}</p>
          <ul className="mt-1 space-y-1">
            {eligible.slice(0, 8).map((row) => (
              <li key={row.song.id}>
                <button type="button" className="text-left text-sm underline decoration-white/30" onClick={() => add.mutate({ songId: row.song.id })}>
                  Add {row.song.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {message ? <p className="text-sm text-rose-200" role="alert">{message}</p> : null}
    </section>
  )
}
