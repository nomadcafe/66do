-- auth_events: append-only audit trail for security-sensitive auth events.
-- Used to (a) drive sign-in notification emails with 24h same-UA dedupe, and
-- (b) record sensitive operations (data export, future: email change /
-- account delete / oauth unbind).
--
-- Privacy posture:
--   - We do NOT store raw IP. Only Vercel-derived approximate region
--     (country + optional city) is persisted, which the user already sees
--     in their notification email.
--   - User-Agent is stored as a sha256 hash for dedupe + a short summary
--     ("Chrome on macOS") for display. Raw UA string is NOT persisted
--     after the email is sent.
--
-- RLS:
--   - SELECT: owner only (auth.uid() = user_id) — so a future "Recent
--     activity" panel in the Settings drawer can show the user their own
--     events without exposing them across tenants.
--   - INSERT: only via service-role client (api/auth/notify-signin and
--     equivalent server endpoints). RLS does not grant INSERT to authed
--     users; they cannot fabricate events.
--   - UPDATE/DELETE: nobody. The table is append-only; cleanup happens via
--     a periodic retention job (see retention_days below).

create table if not exists public.auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'sign_in' | 'data_export' | 'email_change' | 'account_delete' | 'oauth_unbind'
  event_type text not null,
  -- sha256 of the raw user-agent string. 64 hex chars; index target for dedupe.
  ua_hash text,
  -- Human-readable summary, e.g. "Chrome 130 on macOS". Shown in email.
  ua_summary text,
  -- Vercel-derived region. Either "US" or "California, US" depending on what's available.
  region text,
  -- Whether the notification email was successfully sent (false = transient
  -- failure; informational, NOT used to decide future dedupe).
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index used by the dedupe query in src/lib/securityEmail.ts:
--   SELECT 1 FROM auth_events
--   WHERE user_id = $1 AND event_type = 'sign_in' AND ua_hash = $2
--     AND email_sent = true AND created_at > now() - interval '24 hours'
-- Composite covers all selectivity-relevant predicates; created_at desc lets
-- the planner short-circuit on the most-recent row.
create index if not exists auth_events_signin_dedupe_idx
  on public.auth_events (user_id, event_type, ua_hash, created_at desc)
  where email_sent = true;

-- Generic owner-scoped index for the future Settings "Recent activity" view.
create index if not exists auth_events_user_recent_idx
  on public.auth_events (user_id, created_at desc);

alter table public.auth_events enable row level security;

-- Owner-read only. INSERT not granted; service-role bypasses RLS.
drop policy if exists "auth_events: owner can read own" on public.auth_events;
create policy "auth_events: owner can read own"
  on public.auth_events
  for select
  using (auth.uid() = user_id);

-- Explicit deny on writes via authed client (RLS would already deny since
-- there's no policy, but being explicit makes the intent obvious in DB
-- review): no INSERT, UPDATE, or DELETE policies are defined. The only way
-- to write is via the service-role key, which is locked to server-only
-- endpoints in src/lib/supabaseServiceRoleClient.ts.
