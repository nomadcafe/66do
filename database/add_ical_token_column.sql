-- Add a per-user opaque token used as the only auth mechanism for the
-- iCal subscription feed at /api/ical/[token].
--
-- Background:
--   The renewal-calendar feed has to be fetched anonymously by Google
--   Calendar / Apple Calendar / outlook.com on a schedule, with no
--   session cookie or JWT in the request — calendar clients only know
--   how to follow a static URL. Putting the user id in the URL would
--   leak it; using the supabase JWT would expire on every renewal of
--   the user's session. So each user gets a long opaque random token
--   ("renewal_token_xxxxxx") that lives in users.ical_token.
--
-- Properties:
--   - text NULL: column starts NULL on every legacy row; the value is
--     populated lazily the first time the user opens the subscription
--     card in the dashboard, so existing accounts don't need a one-shot
--     migration to backfill.
--   - UNIQUE: the route looks up the row by token, so we never want
--     two users sharing one. (The application generates UUIDv4-shaped
--     tokens, but the unique constraint is defence in depth in case
--     a regenerate ever collides.)
--
--   The token grants read-only access to one user's calendar feed.
--   The dashboard exposes a "regenerate" button so a leaked URL can be
--   invalidated immediately.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ical_token text;

CREATE UNIQUE INDEX IF NOT EXISTS users_ical_token_key
  ON public.users (ical_token)
  WHERE ical_token IS NOT NULL;
