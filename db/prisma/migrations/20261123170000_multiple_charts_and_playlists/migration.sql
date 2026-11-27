-- A genre may have more than one chart in a year, and a chart is not capped at 100.
ALTER TABLE "charts" DROP CONSTRAINT IF EXISTS "charts_year_genre_id_key";

ALTER TABLE "charts" ADD COLUMN "name" TEXT;
UPDATE "charts" SET "name" = "source_name" WHERE "name" IS NULL;
ALTER TABLE "charts" ALTER COLUMN "name" SET NOT NULL;

DROP INDEX IF EXISTS "charts_year_genre_id_key";
CREATE UNIQUE INDEX "charts_year_genre_id_source_name_key" ON "charts"("year", "genre_id", "source_name");

ALTER TABLE "chart_entries" DROP CONSTRAINT IF EXISTS "chart_entries_rank_range";
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_rank_positive" CHECK (rank >= 1);

CREATE TABLE "playlists" (
    "id" SERIAL NOT NULL,
    "genre_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'saved',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "playlist_entries" (
    "id" SERIAL NOT NULL,
    "playlist_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "song_id" INTEGER NOT NULL,

    CONSTRAINT "playlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "song_genres" (
    "song_id" INTEGER NOT NULL,
    "genre_id" INTEGER NOT NULL,

    CONSTRAINT "song_genres_pkey" PRIMARY KEY ("song_id","genre_id")
);

CREATE INDEX "playlists_genre_id_year_idx" ON "playlists"("genre_id", "year");
CREATE UNIQUE INDEX "playlist_entries_playlist_id_song_id_key" ON "playlist_entries"("playlist_id", "song_id");
CREATE UNIQUE INDEX "playlist_entries_playlist_id_position_key" ON "playlist_entries"("playlist_id", "position");

ALTER TABLE "playlists" ADD CONSTRAINT "playlists_year_range" CHECK (year BETWEEN 1925 AND 2100);
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_kind" CHECK (kind IN ('saved', 'dj'));
ALTER TABLE "playlist_entries" ADD CONSTRAINT "playlist_entries_position_positive" CHECK (position >= 1);

ALTER TABLE "playlists" ADD CONSTRAINT "playlists_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "playlist_entries" ADD CONSTRAINT "playlist_entries_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_entries" ADD CONSTRAINT "playlist_entries_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "song_genres" ADD CONSTRAINT "song_genres_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "song_genres" ADD CONSTRAINT "song_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
CROSS JOIN generate_series(1925, EXTRACT(YEAR FROM CURRENT_DATE)::int) AS y(year)
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

GRANT SELECT ON ALL TABLES IN SCHEMA public TO chart_reader;
