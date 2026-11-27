# Music for the Ages

A local archive of music charts from 1860 through the current year. A genre can hold more than one chart in the same year, and a chart is not capped at 100 songs. Songs that show up on more than one chart that year are listed once. Each year can also have saved lists: a song on a list has to be from that year and filed under that genre. Empty years stay empty. Later jazz years still start from obviously fake mock songs (`Mock Song 12`, `Mock Artist B`), except 1965, where Nina Simone replaced the mock chart. Later blues years do too, except 1965, where Son House's Death Letter replaced the mock chart. Ethel Waters and Duke Ellington are in `db/data/jazz/`, and her 1921 blues sides are in `db/data/blues/`. A compiled list of 25 essential blues songs from the 1920s lives in `db/data/blues/`, with the Delta and Chicago sets from 1929 through 1965 in the same folder. Soul lists for 1950–1982 are imported from `db/data/soul/`. Gospel and the jump-blues R&B singles are in `db/data/gospel/` and `db/data/rnb/`. Classical starts in `db/data/classical/` with Johann Strauss II's The Blue Danube in 1867 and Tchaikovsky's Waltz of the Flowers in 1892. Classic ragtime, from Joplin's Maple Leaf Rag in 1899 through Eubie Blake's Charleston Rag in 1917, is in `db/data/ragtime/`. Influential soul listening lists are labeled as listening lists, not charts.

## What you need

- Node.js 20 or newer
- Docker Desktop, for the optional Postgres 16 database

The compose file publishes Postgres on **port 5434** so it can run beside a local PostgreSQL install. On this machine both 5432 and 5433 are already taken.

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run videos:optimize
npm run dev
```

Open the URL Vite prints (usually http://127.0.0.1:5173). The API listens on http://127.0.0.1:3011. Port 3001 is left alone because other local apps often use it. Set `PORT` if you need a different API port, and point the Vite proxy in `web/vite.config.ts` at the same port.

`npm run dev` starts the API and the Vite app together. `videos:optimize` builds muted, 12-second, 720-pixel loops from the clips in `Short_Vids/` and writes them to `web/public/videos/`, along with poster images. Until that finishes, the page shows the poster for the selected genre.

### Use an existing PostgreSQL server

Create a database named `music_for_the_ages`, point `DATABASE_URL` at a user who can create extensions and roles, and set `DATABASE_URL_READONLY` to the `chart_reader` role. The migration creates that role with password `chart_reader` and grants it `SELECT` only. The assistant's tools use the read-only URL.

## Import a chart

CSV columns, in this order:

```text
rank,title,artist,featured_artists,release_year
```

Ranks must be whole numbers starting at 1, with no duplicate ranks and no duplicate song for the same artist. There is no maximum length. If any row fails, the command prints the problems and writes nothing. Importing the same genre, year, and source again replaces that chart and leaves other charts for the year alone.

```bash
npm run import -- --file data/rnb_1965.csv --genre rnb --year 1965 --source "Mock R&B year-end list" --official false
```

`--url` is optional. A file named `{genre}_{year}.csv` can also be imported in bulk:

```bash
npm run import -- --dir data/soul
```

Bulk import uses the genre and year in the filename. Pass `--source` or `--official` to apply them to every file; otherwise each file is recorded as a compiled list whose source is the filename. A `sources.json` file in the directory can set the source, URL, official flag, and note for each file. Example files in `db/data/` contain mock titles only. Real soul lists for 1950–1982 live in `db/data/soul/`. Importing one of those files again replaces that year's list.

Matching is normalized: lower case, punctuation removed, spacing collapsed. Re-importing a year replaces that chart's rows in one transaction and upserts artists and songs.

## Assistant

`LLM_PROVIDER` chooses the model client:

| Value | Client | Needs |
| --- | --- | --- |
| `ollama` (default) | Local Ollama at `OLLAMA_URL` | A pulled model named by `LLM_MODEL` (default `llama3.2`) |
| `openai` | OpenAI chat completions | `LLM_API_KEY` and `LLM_MODEL` |
| `anthropic` | Anthropic Messages API | `LLM_API_KEY` and `LLM_MODEL` |

The model cannot write SQL. It can call `get_chart`, `search_songs`, `artist_history`, `compare_years`, `coverage`, and `set_ui_action`. Those tools run on the read-only connection. A question is limited to 5 rounds of tool calls. In development the server prints each call.

Start Ollama, then pull a model that supports tools:

```bash
ollama pull llama3.2
```

The chat panel keeps the last 20 exchanges. A returned action can open a chart, scroll to a rank, list search hits, or open an artist.

## Voice

Chrome and Edge use the browser Web Speech API, including interim text. Firefox, and browsers without that API, record with the microphone and post the audio to `/api/transcribe`.

That route forwards the file to a local [whisper.cpp](https://github.com/ggml-org/whisper.cpp) server. Build the server, then run it:

```bash
./build/bin/whisper-server -m models/ggml-base.en.bin --port 8080
```

Set `WHISPER_URL=http://127.0.0.1:8080` and restart the API. The server posts audio to `{WHISPER_URL}/inference`. If `WHISPER_URL` is empty, the fallback responds with **501** and the page says "Voice fallback not configured — type instead". Typing always works.

## Keyboard

These work when focus is not in a text field:

- Left / right: previous or next year
- Up / down: previous or next genre
- `/`: focus search
- `m`: microphone
- `h`: coverage heatmap

## Tests

```bash
npm test
```

The importer tests and the API tests expect the migrated, seeded database from `.env`.

## Layout

- `db` — Prisma schema, migrations, seed, CSV importer
- `server` — Fastify API, assistant tools, whisper proxy
- `web` — React archive, heatmap, chat, and voice
- `Short_Vids` — source clips for the background videos
