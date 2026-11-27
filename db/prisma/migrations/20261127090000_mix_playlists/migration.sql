-- A mix playlist draws songs from anywhere in the archive, so it has no single genre or year.
ALTER TABLE "playlists" ALTER COLUMN "genre_id" DROP NOT NULL;
ALTER TABLE "playlists" ALTER COLUMN "year" DROP NOT NULL;

ALTER TABLE "playlists" DROP CONSTRAINT "playlists_year_range";
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_year_range" CHECK (year IS NULL OR year BETWEEN 1880 AND 2100);

ALTER TABLE "playlists" DROP CONSTRAINT "playlists_kind";
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_kind" CHECK (kind IN ('saved', 'dj', 'mix'));
