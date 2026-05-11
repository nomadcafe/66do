-- Audit columns for the iCal subscription token so the user can detect a
-- leaked URL by checking when and where the feed was last pulled.
--
-- Background:
--   The /api/ical/[token] endpoint authorises solely on the opaque token in
--   the URL path. If that URL leaks (browser history sync, email forward,
--   proxy log) the leaker gets permanent read access until the user clicks
--   Regenerate -- and today there's no in-product signal that prompts them
--   to. Surfacing "last fetched 2 minutes ago from a different country" in
--   the subscription card turns leakage into something a user can notice.
--
-- Columns:
--   - ical_last_used_at : timestamptz, updated on every successful feed fetch.
--   - ical_last_used_ip : text, the request IP from x-forwarded-for (Vercel-
--     rewritten so non-spoofable in the prod deployment).
--
--   Both nullable: never-fetched tokens keep NULL and the UI hides the row.
--   No index needed -- columns are read by id and written fire-and-forget.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ical_last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS ical_last_used_ip text;
