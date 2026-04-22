-- Applied: 2026-04-22
-- Issue: Three public tables had `USING (true)` / `WITH CHECK (true)` policies,
--        meaning any anon key holder could read/write all rows:
--          - public.users            (SELECT/INSERT/UPDATE all open)
--          - public.verification_tokens (ALL open)
--          - public.password_reset_tokens (SELECT/INSERT open)
--        Supabase Advisor did NOT catch these — RLS was technically "enabled",
--        but the policies neutered it. The policy names claimed "own rows" but
--        the conditions allowed everyone. Originally introduced by
--        database/complete_user_sync.sql and supabase-migrations/001_*.sql.
--
--        Additionally, three SECURITY DEFINER / trigger functions lacked a
--        pinned search_path (function_search_path_mutable advisor warning).
--
-- Impact analysis (code audit):
--   - public.users: legacy mirror of auth.users kept in sync by SECURITY
--     DEFINER triggers; no app code reads it via anon client.
--   - public.verification_tokens: legacy table, zero references; magic link
--     verification runs through Supabase Auth natively.
--   - public.password_reset_tokens: zero references, password reset uses
--     Supabase Auth natively. Dropped entirely.
--
-- Fix:

-- 1) users: drop the three open policies, keep only self-read.
--    (Writes are performed by SECURITY DEFINER triggers which bypass RLS.)
DROP POLICY IF EXISTS "Allow user creation via email verification" ON public.users;
DROP POLICY IF EXISTS "Allow user read via email verification"     ON public.users;
DROP POLICY IF EXISTS "Allow user update via email verification"   ON public.users;
DROP POLICY IF EXISTS "users_select_self"                          ON public.users;

CREATE POLICY "users_select_self" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- 2) verification_tokens: drop the open policy, no replacement.
--    Zero policies + RLS on = only service_role can access.
DROP POLICY IF EXISTS "Allow all operations on verification_tokens"
  ON public.verification_tokens;

-- 3) password_reset_tokens: dead table, drop entirely along with its helper.
DROP TABLE    IF EXISTS public.password_reset_tokens CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_reset_tokens();

-- 4) Pin search_path on SECURITY DEFINER / trigger functions so they can't
--    be hijacked via a malicious object in another schema on the user's path.
ALTER FUNCTION public.handle_new_user()                SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_user_update()             SET search_path = public, pg_temp;
ALTER FUNCTION public.record_renewal_cost_history()    SET search_path = public, pg_temp;
