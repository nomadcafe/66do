-- Issue: public.schema_migrations is in the public schema (exposed to PostgREST)
--        but had RLS disabled. Anyone with the anon key could read the list of
--        applied migrations or insert/delete rows to corrupt the tracker. Flagged
--        by the Supabase database linter (rls_disabled_in_public).
--
-- Context: The tracker is only written by migrations run from the Supabase SQL
--          editor (privileged role) and only read for ops debugging. No app
--          code accesses it via the anon client. So enabling RLS with zero
--          policies is the correct fix — service_role bypasses RLS, anon/auth
--          users get nothing. Same pattern as verification_tokens in
--          fix_users_verification_tokens_password_reset_rls.sql.
--
-- Fix:
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

INSERT INTO public.schema_migrations (filename, notes)
VALUES (
  'enable_rls_schema_migrations.sql',
  'Enable RLS on the tracker table itself — closes anon-key exposure.'
)
ON CONFLICT (filename) DO NOTHING;
