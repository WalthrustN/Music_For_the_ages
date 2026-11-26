import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState, type RefObject } from 'react'
import { api } from '../api'
import type { ArchiveSettings, PlayerSide } from '../settings'
import { PANEL_ALPHA_MAX, PANEL_ALPHA_MIN } from '../settings'
import type { Genre, SearchHit } from '../types'

export function TopBar({
  genres,
  genre,
  view,
  searchRef,
  onGenre,
  onToggleHeatmap,
  onOpenSoul,
  onPick,
  settings,
  onSettings,
}: {
  genres: Genre[]
  genre: string
  view: 'chart' | 'heatmap' | 'soul'
  searchRef: RefObject<HTMLInputElement | null>
  onGenre: (slug: string) => void
  onToggleHeatmap: () => void
  onOpenSoul: () => void
  onPick: (hit: SearchHit) => void
  settings: ArchiveSettings
  onSettings: (patch: Partial<ArchiveSettings>) => void
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

  const [settingsOpen, setSettingsOpen] = useState(false)
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
        <button
          type="button"
          aria-current={view === 'soul' ? 'page' : undefined}
          onClick={onOpenSoul}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            view === 'soul'
              ? 'border-amber-100 bg-amber-100 text-neutral-950'
              : 'border-white/20 bg-black/50 text-ivory hover:bg-black/70'
          }`}
        >
          About soul
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
        <div className="relative">
          <button
            type="button"
            aria-label="Settings"
            aria-expanded={settingsOpen}
            aria-controls="archive-settings"
            onClick={() => setSettingsOpen((current) => !current)}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/50 text-ivory hover:bg-black/70"
          >
            <Gear />
          </button>
          {settingsOpen ? (
            <SettingsPanel
              settings={settings}
              onSettings={onSettings}
              onClose={() => setSettingsOpen(false)}
            />
          ) : null}
        </div>
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

function SettingsPanel({
  settings,
  onSettings,
  onClose,
}: {
  settings: ArchiveSettings
  onSettings: (patch: Partial<ArchiveSettings>) => void
  onClose: () => void
}) {
  return (
    <div className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-white/15 bg-neutral-950/95 p-4 shadow-2xl" id="archive-settings">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl text-ivory">Settings</h2>
        <button type="button" className="text-sm text-stone-300" onClick={onClose}>Close</button>
      </div>
      <fieldset className="mt-4">
        <legend className="text-xs uppercase tracking-[0.16em] text-gold">Panels</legend>
        <label className="mt-2 block text-sm" htmlFor="panel-alpha">
          Transparency <span className="text-stone-300">{Math.round((1 - settings.panelAlpha) * 100)}%</span>
        </label>
        <input
          id="panel-alpha"
          type="range"
          min={Number((1 - PANEL_ALPHA_MAX).toFixed(2))}
          max={Number((1 - PANEL_ALPHA_MIN).toFixed(2))}
          step={0.05}
          value={Number((1 - settings.panelAlpha).toFixed(2))}
          onChange={(event) => onSettings({ panelAlpha: 1 - Number(event.target.value) })}
          className="mt-2 w-full accent-amber-100"
        />
        <p className="mt-1 text-xs text-stone-400">Higher lets more of the background show through the chart and lists.</p>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="text-xs uppercase tracking-[0.16em] text-gold">Player</legend>
        <p className="mt-2 text-sm">Corner</p>
        <div className="mt-2 flex gap-2">
          {(['left', 'right'] as PlayerSide[]).map((side) => (
            <button
              key={side}
              type="button"
              aria-pressed={settings.playerSide === side}
              onClick={() => onSettings({ playerSide: side })}
              className={`rounded-full px-3 py-1.5 text-sm ${
                settings.playerSide === side ? 'bg-amber-100 text-neutral-950' : 'bg-white/10 text-ivory'
              }`}
            >
              {side === 'left' ? 'Left' : 'Right'}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={settings.playerCollapsed}
          onClick={() => onSettings({ playerCollapsed: !settings.playerCollapsed })}
          className="mt-3 text-sm text-ivory underline decoration-white/30 underline-offset-2"
        >
          {settings.playerCollapsed ? 'Show the video' : 'Collapse the video'}
        </button>
        <p className="mt-1 text-xs text-stone-400">The song keeps playing when the video is collapsed. Collapse and Close are also on the player.</p>
      </fieldset>
    </div>
  )
}

function Gear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" strokeLinecap="round" />
    </svg>
  )
}
