-- The Blue Danube was first heard in 1867.
ALTER TABLE "charts" DROP CONSTRAINT "charts_year_range";
ALTER TABLE "charts" ADD CONSTRAINT "charts_year_range" CHECK (year BETWEEN 1860 AND 2100);

ALTER TABLE "playlists" DROP CONSTRAINT "playlists_year_range";
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_year_range" CHECK (year IS NULL OR year BETWEEN 1860 AND 2100);

CREATE OR REPLACE VIEW "chart_coverage" AS
SELECT
    g.slug AS genre_slug,
    y.year AS year,
    COALESCE(cnt.entry_count, 0)::int AS entry_count,
    CASE
        WHEN cnt.official_count > 0 THEN true
        WHEN cnt.chart_count > 0 THEN false
        ELSE NULL
    END AS is_official
FROM "genres" g
CROSS JOIN generate_series(1860, EXTRACT(YEAR FROM CURRENT_DATE)::int) AS y(year)
LEFT JOIN (
    SELECT
        ch.genre_id,
        ch.year,
        COUNT(DISTINCT ce.song_id)::int AS entry_count,
        COUNT(DISTINCT ch.id)::int AS chart_count,
        COUNT(DISTINCT ch.id) FILTER (WHERE ch.is_official)::int AS official_count
    FROM "charts" ch
    LEFT JOIN "chart_entries" ce ON ce.chart_id = ch.id
    GROUP BY ch.genre_id, ch.year
) cnt ON cnt.genre_id = g.id AND cnt.year = y.year;
