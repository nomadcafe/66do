-- Remove the iCal subscription feature columns.
--
-- Background:
--   The renewal-calendar subscription feature was retired in favour of
--   in-app reminders ("This Week" card). The /api/ical/* routes and the
--   IcalSubscriptionCard UI have been deleted from the app code in the
--   same change set; this migration drops the now-orphaned columns so
--   the schema matches.
--
-- What's removed:
--   - public.users.ical_token        — was the per-user token used as
--                                       URL-path auth for the feed.
--   - public.users.ical_last_used_at — feed-fetch audit timestamp.
--   - public.users.ical_last_used_ip — feed-fetch audit IP.
--
--   The UNIQUE index users_ical_token_key drops automatically with the
--   column. Token values were random UUIDs with no value outside the
--   feed; dropping them is safe and irreversible.
--
-- Compatibility:
--   `IF EXISTS` on every drop so the migration is a no-op against any
--   environment that never ran add_ical_last_used_columns.sql (which was
--   added the same week and may not have reached prod yet).

ALTER TABLE public.users
  DROP COLUMN IF EXISTS ical_token,
  DROP COLUMN IF EXISTS ical_last_used_at,
  DROP COLUMN IF EXISTS ical_last_used_ip;

INSERT INTO public.schema_migrations (filename, notes)
VALUES (
  'drop_ical_columns.sql',
  'Retires the iCal subscription feature; ical_* columns are dropped.'
)
ON CONFLICT (filename) DO NOTHING;
