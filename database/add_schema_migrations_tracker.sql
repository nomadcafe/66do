-- schema_migrations: a flat record of which migration files have been
-- applied to this database.
--
-- Why this exists:
--   Until now there was no source of truth for "which of the 33 SQL
--   files in database/ has actually been run against prod". This bit
--   us repeatedly:
--     - add_auth_events.sql sat unrun for weeks (Recent Activity panel
--       silently empty in prod)
--     - add_ical_token_column.sql state was unknown when /api/ical
--       returned 500
--     - add_registration_date.sql had to be run manually with verbal
--       reminder before the matching code deploy
--   Each of these wasted hours of debugging or risked a broken deploy.
--
-- Convention going forward:
--   Every migration file ends with one line:
--     INSERT INTO public.schema_migrations (filename) VALUES ('<this_filename>.sql');
--   Then `SELECT filename FROM public.schema_migrations ORDER BY applied_at;`
--   tells you exactly what's been applied.
--
-- Backfill:
--   We don't know with certainty which historical files have been run.
--   Don't auto-backfill — the table starts empty. From this migration
--   forward, every new migration writes its row. Old migrations stay
--   "unknown applied state" but in practice are well-tested and live
--   (the schema clearly works). If you want to backfill manually, do
--   it based on what you remember running:
--     INSERT INTO public.schema_migrations (filename, applied_at)
--     VALUES
--       ('migration.sql',                       '2025-01-01'),
--       ('users_table.sql',                     '2025-01-01'),
--       ...
--
-- Long term:
--   Once the project is bigger, replace this with Supabase CLI
--   migrations (`supabase migration new`, `supabase db push`) which
--   tracks via supabase_migrations.schema_migrations and validates
--   ordering. This file is the cheap interim solution.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

COMMENT ON TABLE public.schema_migrations IS
  'Tracks which migration files in database/ have been applied to this database. Insert a row from each migration as its last statement.';

-- Bootstrap: this migration tracks itself so the convention starts here.
INSERT INTO public.schema_migrations (filename, notes)
VALUES (
  'add_schema_migrations_tracker.sql',
  'Bootstrap row — this is the migration that created the tracker table.'
)
ON CONFLICT (filename) DO NOTHING;
