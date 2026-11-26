import type { CoverageCell, Genre } from '../types'

function shade(count: number): string {
  if (count <= 0) return 'rgba(255,255,255,0.06)'
  const amount = 0.28 + (Math.min(count, 100) / 100) * 0.72
  return `rgba(228, 195, 154, ${amount.toFixed(3)})`
}

export function Heatmap({
  genres,
  cells,
  genre,
  year,
  onSelect,
}: {
  genres: Genre[]
  cells: CoverageCell[]
  genre: string
  year: number
  onSelect: (genre: string, year: number) => void
}) {
  const years = [...new Set(cells.map((cell) => cell.year))].sort((a, b) => a - b)
  const byKey = new Map(cells.map((cell) => [`${cell.genreSlug}:${cell.year}`, cell]))
  const chartsOnRecord = cells.filter((cell) => cell.entryCount > 0).length

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-6 sm:px-5" aria-labelledby="coverage-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="coverage-heading" className="font-serif text-3xl">Coverage</h2>
          <p className="text-sm text-stone-300">{chartsOnRecord} charts on record. Empty cells have not been entered.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-300">
          <span>0</span>
          <span className="h-3 w-24 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(228,195,154,1))' }} />
          <span>100+</span>
        </div>
      </div>
      <div className="panel-glass scroll-thin min-h-0 flex-1 overflow-auto rounded-3xl border border-white/15 p-2 backdrop-blur-xl">
        <table className="border-separate border-spacing-1">
          <caption className="sr-only">Songs on record for each genre and year. Choose a cell to open that chart.</caption>
          <thead>
            <tr>
                <th className="sticky top-0 left-0 z-20 bg-neutral-950 px-2 py-1 text-left text-xs font-medium text-stone-400" scope="col">Genre</th>
              {years.map((value) => (
                <th key={value} scope="col" className="sticky top-0 z-10 bg-neutral-950 px-0 text-center text-[10px] font-normal text-stone-400">
                  {value % 10 === 0 ? value : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {genres.map((item) => (
              <tr key={item.slug}>
                <th scope="row" className="sticky left-0 z-10 bg-neutral-950 px-2 text-left text-xs font-medium whitespace-nowrap text-ivory">
                  {item.name}
                </th>
                {years.map((value) => {
                  const cell = byKey.get(`${item.slug}:${value}`)
                  const count = cell?.entryCount ?? 0
                  const selected = item.slug === genre && value === year
                  const label = count === 0
                    ? `${item.name} ${value}, no songs on record`
                    : `${item.name} ${value}, ${count} songs on the charts${cell?.isOfficial ? ', official' : ''}`
                  return (
                    <td key={value} className="p-0">
                      <button
                        type="button"
                        aria-label={label}
                        aria-current={selected ? 'true' : undefined}
                        title={label}
                        onClick={() => onSelect(item.slug, value)}
                        className={`block h-7 w-5 rounded-sm ${selected ? 'ring-2 ring-white' : ''}`}
                        style={{ background: shade(count) }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
