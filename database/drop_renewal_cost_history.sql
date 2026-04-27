-- Drop the renewal_cost_history table and its support trigger/function.
--
-- Background:
--   - The table was originally added (database/add_renewal_cost_history.sql)
--     as a denormalized history table fed by a trigger on
--     domain_transactions: every INSERT of type='renew' produced both a
--     domain_transactions row and a mirrored renewal_cost_history row.
--   - The application has since converged on domain_transactions as the
--     single source of truth for renewal data. The advanced renewal panel
--     (commit 2b2d19f) and the TransactionForm cost-history hint
--     (commit 11b50f9) both derive everything from transactions in memory;
--     nothing in the app reads renewal_cost_history anymore. The /api/
--     renewal-cost-history route was deleted.
--   - Every column in renewal_cost_history is either a direct copy of a
--     domain_transactions field (domain_id, renewal_date <- date,
--     renewal_cost <- amount, currency, registrar <- category, notes) or
--     reconstructible (renewal_cycle was snapshotted from
--     domains.renewal_cycle at trigger time, but the app uses
--     transaction.renewal_period_years for that semantic instead).
--
-- Effect on data:
--   - domain_transactions is untouched. All renewal transactions and their
--     details remain in place.
--   - renewal_cost_history rows are dropped. They carry no unique
--     information; everything is reconstructible from
--     domain_transactions where type='renew'.
--
-- Order matters:
--   1. Drop the trigger so future INSERTs into domain_transactions don't
--      try to write to a missing table.
--   2. Drop the function the trigger called (no other callers).
--   3. Drop the table.

-- 1. Drop the trigger.
DROP TRIGGER IF EXISTS trigger_record_renewal_cost_history ON public.domain_transactions;

-- 2. Drop the trigger function.
DROP FUNCTION IF EXISTS public.record_renewal_cost_history();

-- 3. Drop the table.
DROP TABLE IF EXISTS public.renewal_cost_history;
