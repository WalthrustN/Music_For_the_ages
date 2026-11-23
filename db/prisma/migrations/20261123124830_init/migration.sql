-- CreateTable
CREATE TABLE "genres" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artists" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "songs" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "title_normalized" TEXT NOT NULL,
    "primary_artist_id" INTEGER NOT NULL,
    "featured_artists" TEXT,
    "release_year" INTEGER,

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charts" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "genre_id" INTEGER NOT NULL,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT,
    "is_official" BOOLEAN NOT NULL,
    "methodology_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_entries" (
    "id" SERIAL NOT NULL,
    "chart_id" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "song_id" INTEGER NOT NULL,

    CONSTRAINT "chart_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "artists_name_normalized_key" ON "artists"("name_normalized");

-- CreateIndex
CREATE INDEX "songs_primary_artist_id_idx" ON "songs"("primary_artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "songs_title_normalized_primary_artist_id_key" ON "songs"("title_normalized", "primary_artist_id");

-- CreateIndex
CREATE INDEX "charts_genre_id_year_idx" ON "charts"("genre_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "charts_year_genre_id_key" ON "charts"("year", "genre_id");

-- CreateIndex
CREATE INDEX "chart_entries_song_id_idx" ON "chart_entries"("song_id");

-- CreateIndex
CREATE UNIQUE INDEX "chart_entries_chart_id_rank_key" ON "chart_entries"("chart_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "chart_entries_chart_id_song_id_key" ON "chart_entries"("chart_id", "song_id");

-- AddForeignKey
ALTER TABLE "genres" ADD CONSTRAINT "genres_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "genres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_primary_artist_id_fkey" FOREIGN KEY ("primary_artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charts" ADD CONSTRAINT "charts_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_chart_id_fkey" FOREIGN KEY ("chart_id") REFERENCES "charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigram search and the coverage view.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "songs_title_normalized_trgm_idx" ON "songs" USING GIN ("title_normalized" gin_trgm_ops);
CREATE INDEX "artists_name_normalized_trgm_idx" ON "artists" USING GIN ("name_normalized" gin_trgm_ops);

ALTER TABLE "charts" ADD CONSTRAINT "charts_year_range" CHECK (year BETWEEN 1925 AND 2100);
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_rank_range" CHECK (rank BETWEEN 1 AND 100);

CREATE VIEW "chart_coverage" AS
SELECT
    g.slug AS genre_slug,
    y.year AS year,
    COALESCE(cnt.entry_count, 0)::int AS entry_count,
    ch.is_official
FROM "genres" g
CROSS JOIN generate_series(1925, EXTRACT(YEAR FROM CURRENT_DATE)::int) AS y(year)
LEFT JOIN "charts" ch
    ON ch.genre_id = g.id
   AND ch.year = y.year
LEFT JOIN (
    SELECT chart_id, COUNT(*)::int AS entry_count
    FROM "chart_entries"
    GROUP BY chart_id
) cnt ON cnt.chart_id = ch.id;
