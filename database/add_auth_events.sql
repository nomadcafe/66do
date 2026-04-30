-- auth_events: append-only audit trail for security-sensitive auth events.
-- Drives the dashboard's Recent Activity panel — the user can review every
-- sign-in and sensitive operation (data export today; future: email change /
-- account delete / oauth unbind) and spot anything they didn't trigger.
--
-- Privacy posture:
--   - We do NOT store raw IP. Only Vercel-derived approximate region
--     (country + optional city) is persisted, which is what the user sees.
--   - User-Agent is stored as a sha256 hash (in case future features want
--     per-device dedupe in some other context) and a short summary
--     ("Chrome on macOS") for display.
--
-- RLS:
--   - SELECT: owner only (auth.uid() = user_id) — Recent Activity panel
--     reads under the user's own JWT.
--   - INSERT: only via service-role client (api/auth/notify-signin and
--     equivalent server endpoints). RLS does not grant INSERT to authed
--     users; they cannot fabricate events.
--   - UPDATE/DELETE: nobody. The table is append-only; cleanup happens via
--     a periodic retention job (TBD).

create table if not exists public.auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'sign_in' | 'data_export' | 'email_change' | 'account_delete' | 'oauth_unbind'
  event_type text not null,
  -- sha256 of the raw user-agent string. 64 hex chars.
  ua_hash text,
  -- Human-readable summary, e.g. "Chrome on macOS". Shown in Recent Activity.
  ua_summary text,
  -- Vercel-derived region. Either "US" or "California, US" depending on what's available.
  region text,
  created_at timestamptz not null default now()
);

-- Owner-scoped index for the Recent Activity panel (newest-first window scan).
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
