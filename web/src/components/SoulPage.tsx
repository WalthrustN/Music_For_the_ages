const ERAS: {
  years: string
  text: string
  open: { genre: string; year: number; label: string } | null
}[] = [
  {
    years: '1950–1953',
    text: 'Clyde McPhatter sings lead with the Dominoes, then forms the Drifters. The "5" Royales come out of gospel in Winston-Salem. These years hold their rhythm-and-blues top 10s, in the year each single came out. The rest of early rhythm and blues stays in that genre.',
    open: { genre: 'soul', year: 1950, label: 'Show 1950' },
  },
  {
    years: '1954–1959',
    text: 'Ray Charles puts a gospel voice on rhythm-and-blues rhythm with “I Got a Woman.” Sam Cooke, James Brown, and Jackie Wilson follow. The year’s list is still a compiled set of singles, filed by release date.',
    open: { genre: 'soul', year: 1954, label: 'Show 1954' },
  },
  {
    years: '1960–1968',
    text: 'The word soul spreads. Stax in Memphis and Atlantic carry southern and deep soul. Motown in Detroit makes a smoother pop-soul. Aretha Franklin’s 1967 Atlantic records are the peak of the classic era.',
    open: { genre: 'soul', year: 1960, label: 'Show 1960' },
  },
  {
    years: '1969–1982',
    text: 'Billboard names the chart soul: Best Selling Soul Singles from August 1969, then Hot Soul Singles from July 1973 through June 1982. Philadelphia soul, Al Green, and Stevie Wonder sit in this stretch.',
    open: { genre: 'soul', year: 1969, label: 'Show 1969' },
  },
  {
    years: 'After June 1982',
    text: 'Billboard renames the chart Hot Black Singles, then Hot R&B, then Hot R&B/Hip-Hop. The music widens into funk, contemporary R&B, and rap. Those later charts belong to the R&B and rap genres here, not to soul.',
    open: null,
  },
]

export function SoulPage({
  onOpenChart,
}: {
  onOpenChart: (genre: string, year: number) => void
}) {
  return (
    <main className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-24 sm:px-5">
      <article className="panel-glass mx-auto max-w-3xl rounded-3xl border border-white/15 p-5 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Soul</p>
        <h2 id="soul-heading" className="mt-2 font-serif text-4xl text-ivory">How this archive draws the line</h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-stone-200">
          Soul here runs from Clyde McPhatter’s first hit in 1950 and the “5” Royales through Billboard’s soul chart, which ends in June 1982. Early years are compiled from rhythm-and-blues top 10s and placed in the year the single was released. Charts after the 1982 rename are filed under R&B and rap.
        </p>
        <h3 className="mt-8 font-serif text-2xl text-ivory">Timeline</h3>
        <ol className="mt-4 border-l border-gold/40">
          {ERAS.map((era) => (
            <li key={era.years} className="relative pb-7 pl-6 last:pb-0">
              <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-gold" aria-hidden="true" />
              <p className="text-xs uppercase tracking-[0.16em] text-gold">{era.years}</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-200">{era.text}</p>
              {era.open ? (
                <button
                  type="button"
                  className="mt-2 text-sm text-ivory underline decoration-white/30 underline-offset-2 hover:decoration-gold"
                  onClick={() => onOpenChart(era.open!.genre, era.open!.year)}
                >
                  {era.open.label}
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      </article>
    </main>
  )
}
