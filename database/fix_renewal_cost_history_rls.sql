-- Applied: 2026-04-22
-- Issue: Supabase Advisor flagged `rls_disabled_in_public` on public.renewal_cost_history.
--        The table was the only public table with RLS disabled, exposing all renewal
--        cost history rows to any holder of the anon key.
-- Fix:   Enable RLS and add per-action policies. The table has no direct user_id
--        column, so ownership is checked via the parent domains.user_id.
--        The record_renewal_cost_history() trigger (run as the inserting user's
--        session) passes the INSERT policy because the transaction it fires from
--        has already been gated by domain_transactions RLS.

ALTER TABLE public.renewal_cost_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rch_select_own" ON public.renewal_cost_history;
DROP POLICY IF EXISTS "rch_insert_own" ON public.renewal_cost_history;
DROP POLICY IF EXISTS "rch_update_own" ON public.renewal_cost_history;
DROP POLICY IF EXISTS "rch_delete_own" ON public.renewal_cost_history;

CREATE POLICY "rch_select_own" ON public.renewal_cost_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.domains d
            WHERE d.id = renewal_cost_history.domain_id
              AND d.user_id = auth.uid())
  );

CREATE POLICY "rch_insert_own" ON public.renewal_cost_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.domains d
            WHERE d.id = renewal_cost_history.domain_id
              AND d.user_id = auth.uid())
  );

CREATE POLICY "rch_update_own" ON public.renewal_cost_history
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.domains d
            WHERE d.id = renewal_cost_history.domain_id
              AND d.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.domains d
            WHERE d.id = renewal_cost_history.domain_id
              AND d.user_id = auth.uid())
  );

CREATE POLICY "rch_delete_own" ON public.renewal_cost_history
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.domains d
            WHERE d.id = renewal_cost_history.domain_id
              AND d.user_id = auth.uid())
  );
