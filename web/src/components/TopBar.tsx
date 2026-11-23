import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState, type RefObject } from 'react'
import { api } from '../api'
import type { Genre, SearchHit } from '../types'

export function TopBar({
  genres,
  genre,
  view,
  searchRef,
  onGenre,
  onToggleHeatmap,
  onPick,
}: {
  genres: Genre[]
  genre: string
  view: 'chart' | 'heatmap'
  searchRef: RefObject<HTMLInputElement | null>
  onGenre: (slug: string) => void
  onToggleHeatmap: () => void
  onPick: (hit: SearchHit) => void
}) {
  const listId = useId()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(q.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [q])

  const search = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.search({ q: debounced, limit: 8 }),
    enabled: debounced.length > 0,
  })

  const results = search.data?.results ?? []

  return (
    <header className="flex flex-col gap-3 px-3 pt-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl tracking-tight text-ivory sm:text-3xl">Music for the Ages</h1>
        <button
          type="button"
          aria-pressed={view === 'heatmap'}
          onClick={onToggleHeatmap}
          className="rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-sm text-ivory hover:bg-black/70"
        >
          Coverage
        </button>
        <form
          role="search"
          className="relative ml-auto w-full min-w-0 sm:max-w-sm"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor="archive-search" className="sr-only">Search songs and artists</label>
          <input
            id="archive-search"
            ref={searchRef}
            type="search"
            value={q}
            placeholder="Search songs and artists"
            autoComplete="off"
            aria-controls={listId}
            aria-expanded={open && debounced.length > 0}
            onChange={(event) => {
              setQ(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            className="w-full rounded-full border border-white/20 bg-black/55 px-4 py-2 text-sm text-ivory placeholder:text-stone-400"
          />
          {open && debounced.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Search results"
              className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-white/15 bg-neutral-950/95 p-1 shadow-2xl"
            >
              {search.isFetching ? <li className="px-3 py-2 text-sm text-stone-300">Searching…</li> : null}
              {search.isError ? <li className="px-3 py-2 text-sm text-rose-200">{(search.error as Error).message}</li> : null}
              {!search.isFetching && results.length === 0 ? (
                <li className="px-3 py-2 text-sm text-stone-300">No songs match.</li>
              ) : null}
              {results.map((hit) => (
                <li key={`${hit.songId}-${hit.genreSlug}-${hit.year}-${hit.rank}`} role="option">
                  <button
                    type="button"
                    className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => {
                      onPick(hit)
                      setOpen(false)
                      setQ('')
                    }}
                  >
                    <span className="font-serif text-ivory">{hit.title}</span>
                    <span className="text-xs text-stone-300">
                      {hit.artistName} · {hit.genreName} {hit.year} · #{hit.rank}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      </div>
      <div className="scroll-thin flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Genres">
        {genres.map((item) => {
          const selected = item.slug === genre
          return (
            <button
              key={item.slug}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onGenre(item.slug)}
              className={`shrink-0 rounded-full px-3 py-2 text-sm ${
                selected ? 'bg-amber-100 text-neutral-950' : 'bg-black/50 text-ivory hover:bg-black/70'
              }`}
            >
              {item.name}
            </button>
          )
        })}
      </div>
    </header>
  )
}
