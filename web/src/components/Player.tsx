import type { PlayerSide } from '../settings'

export function Player({
  title,
  artist,
  videoId,
  side,
  collapsed,
  onToggleCollapsed,
  onClose,
}: {
  title: string
  artist: string
  videoId: string
  side: PlayerSide
  collapsed: boolean
  onToggleCollapsed: () => void
  onClose: () => void
}) {
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`
  const place = side === 'right'
    ? 'bottom-24 right-3 sm:right-5'
    : 'bottom-4 left-3 sm:left-5'
  return (
    <section className={`fixed z-30 w-72 overflow-hidden rounded-2xl border border-white/15 bg-neutral-950/95 shadow-2xl ${place}`} aria-label="Now playing">
      <div className={collapsed ? 'h-0 overflow-hidden' : ''}>
        <iframe
          key={videoId}
          className="aspect-video w-full"
          src={src}
          title={`Play ${title} by ${artist}`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="min-w-0">
          <span className="block truncate font-serif text-ivory">{title}</span>
          <span className="block truncate text-xs text-stone-300">{artist}</span>
        </p>
        <button type="button" className="shrink-0 text-sm text-stone-300" onClick={onToggleCollapsed}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
        <button type="button" className="shrink-0 text-sm text-stone-300" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  )
}
