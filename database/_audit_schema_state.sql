-- Read-only audit queries — run these in Supabase SQL editor and send
-- the output back. Based on the results we'll write the conditional
-- fix migrations (#5 date types, #6 missing FK).
--
-- Underscore prefix marks this as a one-off audit script, not a
-- migration that needs to be applied to prod.

-- ============================================================
-- Audit 1: column data types on every date-ish column
-- ============================================================
-- We expect 'date' for all of these. If any returns 'text' / 'character
-- varying' we have to ALTER COLUMN ... TYPE date USING ...::date so
-- chronological comparisons work in SQL (not just in the JS layer).
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'domains' AND column_name IN (
      'purchase_date',
      'expiry_date',
      'sale_date',
      'next_renewal_date',
      'baseline_renewal_as_of',
      'registration_date'
    ))
    OR
    (table_name = 'domain_transactions' AND column_name IN (
      'date',
      'installment_first_payment_date'
    ))
  )
ORDER BY table_name, column_name;

-- ============================================================
-- Audit 2: foreign keys on domains + domain_transactions
-- ============================================================
-- We expect:
--   - domains.user_id           → auth.users(id) ON DELETE CASCADE
--   - domain_transactions.user_id   → auth.users(id) ON DELETE CASCADE
--   - domain_transactions.domain_id → public.domains(id) ON DELETE CASCADE  ← key risk: may be missing
--
-- If domain_transactions.domain_id has no FK, deleting a domain leaves
-- orphan transaction rows that break analytics.
SELECT
  c.conrelid::regclass        AS table_name,
  c.conname                    AS constraint_name,
  pg_get_constraintdef(c.oid)  AS definition
FROM pg_constraint c
WHERE c.contype = 'f'
  AND c.conrelid::regclass::text IN ('domains', 'domain_transactions')
ORDER BY c.conrelid::regclass::text, c.conname;

-- ============================================================
-- Audit 3: orphan transaction rows (defensive — might block FK creation)
-- ============================================================
-- If FK is missing AND there are transaction rows whose domain_id
-- doesn't exist in domains, ADD CONSTRAINT will fail. This counts how
-- many such orphans exist. Expected: 0. Non-zero means we either
-- backfill / delete those rows first, or add the FK with NOT VALID and
-- accept the historical mess.
SELECT
  COUNT(*) AS orphan_transaction_rows
FROM public.domain_transactions t
LEFT JOIN public.domains d ON d.id = t.domain_id
WHERE d.id IS NULL;

-- ============================================================
-- Audit 4: row counts (sanity check; useful context)
-- ============================================================
SELECT 'domains' AS table_name, COUNT(*) AS rows FROM public.domains
UNION ALL
SELECT 'domain_transactions', COUNT(*) FROM public.domain_transactions
UNION ALL
SELECT 'auth_events', COUNT(*) FROM public.auth_events
UNION ALL
SELECT 'users', COUNT(*) FROM public.users;
