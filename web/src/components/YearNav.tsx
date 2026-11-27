import { useEffect } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

const YEAR_MIN = 1880

export function YearNav({
  year,
  maxYear,
  counts,
  onYear,
}: {
  year: number
  maxYear: number
  counts: Map<number, number>
  onYear: (year: number) => void
}) {
  const reduced = usePrefersReducedMotion()
  const decades: number[] = []
  for (let decade = 1880; decade <= maxYear; decade += 10) decades.push(decade)
  const years: number[] = []
  for (let value = YEAR_MIN; value <= maxYear; value += 1) years.push(value)
  const activeDecade = Math.floor(year / 10) * 10

  useEffect(() => {
    document.getElementById(`year-${year}`)?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [year, reduced])

  return (
    <div className="flex flex-col gap-2 px-3 sm:px-5">
      <div className="scroll-thin flex gap-2 overflow-x-auto" role="group" aria-label="Jump to decade">
        {decades.map((decade) => (
          <button
            key={decade}
            type="button"
            aria-pressed={decade === activeDecade}
            onClick={() => onYear(Math.max(YEAR_MIN, Math.min(maxYear, decade)))}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
              decade === activeDecade ? 'bg-white/20 text-ivory' : 'bg-black/40 text-stone-300'
            }`}
          >
            {decade}s
          </button>
        ))}
      </div>
      <div className="scroll-thin flex snap-x snap-mandatory gap-1 overflow-x-auto pb-1" role="listbox" aria-label="Years">
        {years.map((value) => {
          const count = counts.get(value)
          const empty = count === 0
          const selected = value === year
          return (
            <button
              key={value}
              id={`year-${value}`}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={empty ? `${value}, no chart on record` : `${value}, ${count ?? 'unknown'} songs`}
              onClick={() => onYear(value)}
              className={`snap-center flex min-w-14 shrink-0 flex-col items-center rounded-xl px-2 py-1.5 text-sm tabular-nums ${
                selected
                  ? 'bg-amber-100 text-neutral-950'
                  : empty
                    ? 'bg-black/35 text-stone-500'
                    : 'bg-black/50 text-ivory'
              }`}
            >
              <span>{value}</span>
              <span className={`mt-1 h-1.5 w-1.5 rounded-full ${empty || count == null ? 'bg-transparent' : selected ? 'bg-neutral-950' : 'bg-gold'}`} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
