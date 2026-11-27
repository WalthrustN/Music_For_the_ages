import { useEffect, useRef, useState } from 'react'
import { FixedSizeList, type ListChildComponentProps } from 'react-window'
import type { ChartPayload, ChartSong } from '../types'
import { thumbnailUrl } from '../youtube'

type RowData = {
  entries: ChartSong[]
  highlightRank: number | null
  playlistArmed: boolean
  onOpenSong: (id: number) => void
  onOpenArtist: (id: number) => void
  onPlay: (entry: ChartSong) => void
  onAdd: (entry: ChartSong) => void
}

function Thumbnail({ entry, onOpenSong, onPlay }: { entry: ChartSong; onOpenSong: (id: number) => void; onPlay: (entry: ChartSong) => void }) {
  const videoId = entry.song.youtubeVideoId
  if (!videoId) {
    return (
      <button
        type="button"
        aria-label={`No recording linked for ${entry.song.title}. Add one.`}
        className="grid h-10 w-16 place-items-center rounded-md border border-dashed border-white/25 text-xs text-stone-400"
        onClick={() => onOpenSong(entry.song.id)}
      >
        Link
      </button>
    )
  }
  return (
    <button
      type="button"
      aria-label={`Play ${entry.song.title} by ${entry.artist.name}`}
      className="relative h-10 w-16 overflow-hidden rounded-md bg-black"
      onClick={() => onPlay(entry)}
    >
      <img src={thumbnailUrl(videoId)} alt="" className="h-full w-full object-cover" />
      <span className="absolute inset-0 grid place-items-center bg-black/30 text-sm text-ivory" aria-hidden="true">▶</span>
    </button>
  )
}

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const entry = data.entries[index]
  const active = entry.bestRank === data.highlightRank
  const sources = [...new Set(entry.charts.map((chart) => chart.sourceName))].join(', ')
  return (
    <div style={style} className="px-2">
      <div className={`grid h-16 grid-cols-[3rem_4.5rem_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl px-3 ${
        active ? 'bg-amber-200/20 ring-1 ring-amber-200/80' : 'hover:bg-white/5'
      }`}
      >
        <span className="font-serif text-lg tabular-nums text-gold">{String(entry.bestRank).padStart(2, '0')}</span>
        <Thumbnail entry={entry} onOpenSong={data.onOpenSong} onPlay={data.onPlay} />
        <span className="min-w-0">
          <button
            type="button"
            className="block max-w-full truncate text-left font-serif text-lg text-ivory"
            onClick={() => {
              data.onOpenSong(entry.song.id)
              if (entry.song.youtubeVideoId) data.onPlay(entry)
            }}
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
        <span className="max-w-40 truncate text-right text-xs text-stone-400">{sources}</span>
        <button
          type="button"
          aria-label={`Add ${entry.song.title} to playlist`}
          title="Add to playlist"
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm ${
            data.playlistArmed
              ? 'border-gold/50 text-gold hover:bg-white/10'
              : 'border-white/20 text-ivory hover:bg-white/10'
          }`}
          onClick={() => data.onAdd(entry)}
        >
          +
        </button>
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
  onPlay,
  onAdd,
  playlistArmed,
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
  onPlay: (entry: ChartSong) => void
  onAdd: (entry: ChartSong) => void
  playlistArmed: boolean
}) {
  const frame = useRef<HTMLDivElement>(null)
  const listRef = useRef<FixedSizeList>(null)
  const [height, setHeight] = useState(360)
  const entries = chart?.songs ?? []

  useEffect(() => {
    const element = frame.current
    if (!element) return
    const observer = new ResizeObserver(() => setHeight(Math.max(160, element.clientHeight)))
    observer.observe(element)
    setHeight(Math.max(160, element.clientHeight))
    return () => observer.disconnect()
  }, [chart?.songs.length, isLoading])

  useEffect(() => {
    if (highlightRank == null) return
    const index = entries.findIndex((entry) => entry.bestRank === highlightRank)
    if (index >= 0) listRef.current?.scrollToItem(index, 'center')
  }, [highlightRank, entries])

  return (
    <section className="panel-glass flex min-h-0 flex-1 flex-col rounded-3xl border border-white/15 shadow-2xl shadow-black/40" aria-labelledby="chart-heading">
      <header className="border-b border-white/10 px-4 py-4 sm:px-6">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">{genreName}</p>
        <h2 id="chart-heading" className="font-serif text-4xl text-ivory">{year}</h2>
        {isLoading ? <div className="mt-3 h-4 w-48 animate-pulse rounded bg-white/10" /> : null}
        {chart && chart.charts.length > 0 ? (
          <div className="mt-3 space-y-2 text-sm text-stone-200">
            <p>{chart.songs.length} songs on the charts this year, with no duplicate titles.</p>
            {chart.charts.map((record) => (
              <div key={record.id} className="flex flex-wrap items-center gap-2">
                <span>{record.sourceName}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${record.isOfficial ? 'bg-emerald-300/20 text-emerald-100' : 'bg-amber-200/15 text-amber-100'}`}>
                  {record.isOfficial ? 'Official' : 'Compiled'}
                </span>
                <span className="text-stone-400">{record.entryCount} songs</span>
                {record.sourceUrl ? (
                  <a className="underline decoration-white/30 underline-offset-2" href={record.sourceUrl} target="_blank" rel="noreferrer">
                    Source
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {chart?.charts[0]?.methodologyNote ? <p className="mt-2 max-w-2xl text-sm text-stone-300">{chart.charts[0].methodologyNote}</p> : null}
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
        {!isLoading && !isError && entries.length === 0 ? (
          <div className="p-6">
            <h3 className="font-serif text-2xl">No chart on record</h3>
            <p className="mt-2 max-w-lg text-stone-300">
              Nothing has been entered for {genreName} in {year}. Empty years stay empty. Import a CSV when you have a source.
            </p>
          </div>
        ) : null}
        {!isLoading && !isError && entries.length > 0 ? (
          <FixedSizeList
            ref={listRef}
            height={height}
            width="100%"
            itemCount={entries.length}
            itemSize={72}
            itemData={{ entries, highlightRank, playlistArmed, onOpenSong, onOpenArtist, onPlay, onAdd }}
            itemKey={(index, data) => data.entries[index].song.id}
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
