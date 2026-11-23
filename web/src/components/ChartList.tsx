import { useEffect, useRef, useState } from 'react'
import { FixedSizeList, type ListChildComponentProps } from 'react-window'
import type { ChartEntry, ChartPayload } from '../types'

type RowData = {
  entries: ChartEntry[]
  highlightRank: number | null
  onOpenSong: (id: number) => void
  onOpenArtist: (id: number) => void
}

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const entry = data.entries[index]
  const active = entry.rank === data.highlightRank
  return (
    <div style={style} className="px-2">
      <div className={`grid h-16 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 ${
        active ? 'bg-amber-200/20 ring-1 ring-amber-200/80' : 'hover:bg-white/5'
      }`}
      >
        <span className="font-serif text-lg tabular-nums text-gold">{String(entry.rank).padStart(2, '0')}</span>
        <span className="min-w-0">
          <button
            type="button"
            className="block max-w-full truncate text-left font-serif text-lg text-ivory"
            onClick={() => data.onOpenSong(entry.song.id)}
          >
            {entry.song.title}
          </button>
          <button
            type="button"
            className="block max-w-full truncate text-left text-sm text-stone-300"
            onClick={() => data.onOpenArtist(entry.artist.id)}
          >
            {entry.artist.name}
          </button>
        </span>
        <span className="text-sm tabular-nums text-stone-400">{entry.song.releaseYear ?? ''}</span>
      </div>
    </div>
  )
}

export function ChartList({
  genreName,
  year,
  chart,
  isLoading,
  isError,
  error,
  onRetry,
  highlightRank,
  onOpenSong,
  onOpenArtist,
}: {
  genreName: string
  year: number
  chart?: ChartPayload
  isLoading: boolean
  isError: boolean
  error: Error | null
  onRetry: () => void
  highlightRank: number | null
  onOpenSong: (id: number) => void
  onOpenArtist: (id: number) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const listRef = useRef<FixedSizeList>(null)
  const [height, setHeight] = useState(360)
  const entries = chart?.entries ?? []

  useEffect(() => {
    const element = frame.current
    if (!element) return
    const observer = new ResizeObserver(() => setHeight(Math.max(160, element.clientHeight)))
    observer.observe(element)
    setHeight(Math.max(160, element.clientHeight))
    return () => observer.disconnect()
  }, [chart?.chart?.id, isLoading])

  useEffect(() => {
    if (highlightRank == null) return
    const index = entries.findIndex((entry) => entry.rank === highlightRank)
    if (index >= 0) listRef.current?.scrollToItem(index, 'center')
  }, [highlightRank, entries])

  const record = chart?.chart

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-3xl border border-white/15 bg-neutral-950/75 shadow-2xl shadow-black/40 backdrop-blur-xl" aria-labelledby="chart-heading">
      <header className="border-b border-white/10 px-4 py-4 sm:px-6">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">{genreName}</p>
        <h2 id="chart-heading" className="font-serif text-4xl text-ivory">{year}</h2>
        {isLoading ? <div className="mt-3 h-4 w-48 animate-pulse rounded bg-white/10" /> : null}
        {record ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-200">
            <span>{record.sourceName}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${record.isOfficial ? 'bg-emerald-300/20 text-emerald-100' : 'bg-amber-200/15 text-amber-100'}`}>
              {record.isOfficial ? 'Official' : 'Compiled'}
            </span>
            {record.sourceUrl ? (
              <a className="underline decoration-white/30 underline-offset-2" href={record.sourceUrl} target="_blank" rel="noreferrer">
                Source
              </a>
            ) : null}
            {record.entryCount < 100 ? (
              <span className="text-stone-300">{record.entryCount} of 100 songs on record</span>
            ) : null}
          </div>
        ) : null}
        {record?.methodologyNote ? <p className="mt-2 max-w-2xl text-sm text-stone-300">{record.methodologyNote}</p> : null}
      </header>
      <div ref={frame} className="relative min-h-0 flex-1">
        {isLoading ? (
          <div className="space-y-2 p-4" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : null}
        {isError ? (
          <div className="p-6" role="alert">
            <p>{error?.message || 'The chart could not be loaded.'}</p>
            <button type="button" className="mt-3 rounded-full bg-amber-100 px-3 py-1.5 text-sm text-neutral-950" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}
        {!isLoading && !isError && !record ? (
          <div className="p-6">
            <h3 className="font-serif text-2xl">No chart on record</h3>
            <p className="mt-2 max-w-lg text-stone-300">
              Nothing has been entered for {genreName} in {year}. Empty years stay empty. Import a CSV when you have a source.
            </p>
          </div>
        ) : null}
        {!isLoading && !isError && record && entries.length > 0 ? (
          <FixedSizeList
            ref={listRef}
            height={height}
            width="100%"
            itemCount={entries.length}
            itemSize={72}
            itemData={{ entries, highlightRank, onOpenSong, onOpenArtist }}
            itemKey={(index, data) => data.entries[index].rank}
            overscanCount={8}
            style={{ position: 'absolute', inset: 0 }}
          >
            {Row}
          </FixedSizeList>
        ) : null}
      </div>
    </section>
  )
}
