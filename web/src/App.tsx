import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { api } from './api'
import { Assistant, type AssistantHandle } from './components/Assistant'
import { ChartList } from './components/ChartList'
import { Player } from './components/Player'
import { Drawer } from './components/Drawer'
import { Heatmap } from './components/Heatmap'
import { SoulPage } from './components/SoulPage'
import { TopBar } from './components/TopBar'
import { VideoBackground } from './components/VideoBackground'
import { YearLists } from './components/YearLists'
import { YearNav } from './components/YearNav'
import { useHotkeys } from './hooks/useHotkeys'
import { useSettings } from './hooks/useSettings'
import type { ChartSong, SearchHit, UiAction } from './types'

type NowPlaying = {
  songId: number
  title: string
  artist: string
  videoId: string
}

const YEAR_MIN = 1880

export function App() {
  const genresQuery = useQuery({ queryKey: ['genres'], queryFn: api.genres })
  const coverageQuery = useQuery({ queryKey: ['coverage'], queryFn: api.coverage })
  const [genre, setGenre] = useState('soul')
  const [year, setYear] = useState(1972)
  const [view, setView] = useState<'chart' | 'heatmap' | 'soul'>('chart')
  const [songId, setSongId] = useState<number | null>(null)
  const [artistId, setArtistId] = useState<number | null>(null)
  const [highlightRank, setHighlightRank] = useState<number | null>(null)
  const [playing, setPlaying] = useState<NowPlaying | null>(null)
  const { settings, update: updateSettings } = useSettings()
  const searchRef = useRef<HTMLInputElement>(null)
  const assistantRef = useRef<AssistantHandle>(null)

  const genres = genresQuery.data?.genres ?? []
  const coverage = coverageQuery.data?.coverage ?? []
  const maxYear = coverage.reduce((max, cell) => Math.max(max, cell.year), new Date().getFullYear())
  const counts = useMemo(() => {
    const map = new Map<number, number>()
    for (const cell of coverage) {
      if (cell.genreSlug === genre) map.set(cell.year, cell.entryCount)
    }
    return map
  }, [coverage, genre])

  const chartQuery = useQuery({
    queryKey: ['chart', genre, year],
    queryFn: () => api.chart(genre, year),
    enabled: view === 'chart',
  })

  const genreName = genres.find((item) => item.slug === genre)?.name ?? genre

  function selectYear(next: number) {
    setYear(Math.min(maxYear, Math.max(YEAR_MIN, next)))
    setHighlightRank(null)
  }

  function selectGenre(slug: string) {
    setGenre(slug)
    setHighlightRank(null)
    setView((current) => (current === 'soul' ? 'chart' : current))
  }

  function openChartAt(slug: string, nextYear: number) {
    setGenre(slug)
    setYear(Math.min(maxYear, Math.max(YEAR_MIN, nextYear)))
    setHighlightRank(null)
    setView('chart')
  }

  function playEntry(entry: ChartSong) {
    if (!entry.song.youtubeVideoId) return
    setPlaying({
      songId: entry.song.id,
      title: entry.song.title,
      artist: entry.artist.name,
      videoId: entry.song.youtubeVideoId,
    })
  }

  function playRecording(song: { songId: number; title: string; artist: string; videoId: string | null }) {
    if (!song.videoId) {
      setPlaying((current) => (current?.songId === song.songId ? null : current))
      return
    }
    setPlaying({ songId: song.songId, title: song.title, artist: song.artist, videoId: song.videoId })
  }

  function openHit(hit: SearchHit) {
    setGenre(hit.genreSlug)
    setYear(hit.year)
    setHighlightRank(hit.rank)
    setView('chart')
    setSongId(null)
    setArtistId(null)
  }

  function applyAction(action: UiAction) {
    if (action.type === 'showChart') {
      setGenre(action.genre)
      setYear(action.year)
      setView('chart')
      setHighlightRank(action.rank ?? null)
    } else if (action.type === 'scrollToRank') {
      setView('chart')
      setHighlightRank(action.rank)
    } else if (action.type === 'showArtist') {
      setArtistId(action.artistId)
      setSongId(null)
    } else if (action.type === 'playSong') {
      if (action.genre) setGenre(action.genre)
      if (action.year) setYear(Math.min(maxYear, Math.max(YEAR_MIN, action.year)))
      setHighlightRank(action.rank ?? null)
      setView('chart')
      setSongId(null)
      setArtistId(null)
      if (action.videoId) {
        setPlaying({
          songId: action.songId,
          title: action.title,
          artist: action.artist,
          videoId: action.videoId,
        })
      }
    }
  }

  useHotkeys({
    onYear: (delta) => selectYear(year + delta),
    onGenre: (delta) => {
      if (genres.length === 0) return
      const index = genres.findIndex((item) => item.slug === genre)
      const next = genres[(index + delta + genres.length) % genres.length]
      if (next) selectGenre(next.slug)
    },
    onSearch: () => searchRef.current?.focus(),
    onMic: () => assistantRef.current?.toggleMic(),
    onHeatmap: () => setView((current) => (current === 'heatmap' ? 'chart' : 'heatmap')),
    captureArrows: view !== 'soul',
  })

  return (
    <div className="relative h-dvh overflow-hidden text-ivory">
      <a href={view === 'soul' ? '#soul-heading' : '#chart-heading'} className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-full focus:bg-amber-100 focus:px-3 focus:py-2 focus:text-neutral-950">
        {view === 'soul' ? 'Skip to soul' : 'Skip to chart'}
      </a>
      <VideoBackground genre={genre} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/45 to-black/80" />
      <div className="relative z-10 flex h-full flex-col gap-3">
        {genresQuery.isError ? (
          <p className="m-4 rounded-2xl bg-neutral-950/80 p-4" role="alert">
            {(genresQuery.error as Error).message}
          </p>
        ) : (
          <TopBar
            genres={genres}
            genre={genre}
            view={view}
            searchRef={searchRef}
            onGenre={selectGenre}
            onToggleHeatmap={() => setView((current) => (current === 'heatmap' ? 'chart' : 'heatmap'))}
            onOpenSoul={() => setView((current) => (current === 'soul' ? 'chart' : 'soul'))}
            onPick={openHit}
            settings={settings}
            onSettings={updateSettings}
          />
        )}
        {view === 'heatmap' ? (
          coverageQuery.isError ? (
            <p className="px-5" role="alert">{(coverageQuery.error as Error).message}</p>
          ) : (
            <Heatmap
              genres={genres}
              cells={coverage}
              genre={genre}
              year={year}
              onSelect={(slug, nextYear) => {
                setGenre(slug)
                setYear(nextYear)
                setHighlightRank(null)
                setView('chart')
              }}
            />
          )
        ) : view === 'soul' ? (
          <SoulPage onOpenChart={openChartAt} />
        ) : (
          <>
            <YearNav year={year} maxYear={maxYear} counts={counts} onYear={selectYear} />
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-24 sm:px-5 lg:flex-row lg:overflow-hidden">
              <div className="flex min-h-80 min-w-0 flex-1 flex-col gap-3">
                <ChartList
                  genreName={genreName}
                  year={year}
                  chart={chartQuery.data}
                  isLoading={chartQuery.isLoading}
                  isError={chartQuery.isError}
                  error={chartQuery.error as Error | null}
                  onRetry={() => { void chartQuery.refetch() }}
                  highlightRank={highlightRank}
                  onOpenSong={(id) => { setSongId(id); setArtistId(null) }}
                  onOpenArtist={(id) => { setArtistId(id); setSongId(null) }}
                  onPlay={playEntry}
                />
              </div>
              <YearLists
                genre={genre}
                genreName={genreName}
                year={year}
                playlists={chartQuery.data?.playlists ?? []}
                charted={chartQuery.data?.songs ?? []}
              />
            </div>
          </>
        )}
        <p className="sr-only">
          Keyboard shortcuts: left and right arrows change year, up and down arrows change genre, slash focuses search, m toggles the microphone, h toggles coverage.
        </p>
        {playing ? null : (
          <p className="pointer-events-none absolute bottom-3 left-3 hidden text-[11px] tracking-wide text-stone-300 sm:block">
            ← → year · ↑ ↓ genre · / search · m mic · h coverage
          </p>
        )}
      </div>
      <Drawer
        songId={songId}
        artistId={artistId}
        onClose={() => { setSongId(null); setArtistId(null) }}
        onOpenArtist={(id) => { setArtistId(id); setSongId(null) }}
        onOpenChart={(slug, nextYear, rank) => {
          setGenre(slug)
          setYear(nextYear)
          setHighlightRank(rank)
          setView('chart')
        }}
        onPlay={playRecording}
      />
      {playing ? (
        <Player
          title={playing.title}
          artist={playing.artist}
          videoId={playing.videoId}
          side={settings.playerSide}
          collapsed={settings.playerCollapsed}
          onToggleCollapsed={() => updateSettings({ playerCollapsed: !settings.playerCollapsed })}
          onClose={() => setPlaying(null)}
        />
      ) : null}
      <Assistant handleRef={assistantRef} onAction={applyAction} onPick={openHit} />
    </div>
  )
}
