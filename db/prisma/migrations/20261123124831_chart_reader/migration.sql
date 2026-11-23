-- prisma-migrate-no-transaction
-- chart_reader is SELECT-only. Password matches DATABASE_URL_READONLY in .env.example.
CREATE ROLE chart_reader LOGIN PASSWORD 'chart_reader' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

GRANT CONNECT ON DATABASE music_for_the_ages TO chart_reader;
GRANT USAGE ON SCHEMA public TO chart_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO chart_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO chart_reader;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM chart_reader;
