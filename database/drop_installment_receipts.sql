-- Rollback for add_installment_receipts.sql.
-- Restores paid_periods on domain_transactions from the receipt count, then
-- drops the receipts table. After rolling back, the legacy synthesized-from-
-- paid_periods cash-receipt logic in coreCalculations.ts is correct again.

-- 1. Re-add paid_periods column (no-op if it still exists).
alter table public.domain_transactions
  add column if not exists paid_periods integer;

-- 2. Backfill paid_periods from current receipt counts.
update public.domain_transactions dt
set paid_periods = sub.cnt
from (
  select transaction_id, count(*)::int as cnt
  from public.installment_receipts
  group by transaction_id
) sub
where sub.transaction_id = dt.id;

-- 3. Drop policies + table.
drop policy if exists "Users can view own installment receipts" on public.installment_receipts;
drop policy if exists "Users can insert own installment receipts" on public.installment_receipts;
drop policy if exists "Users can update own installment receipts" on public.installment_receipts;
drop policy if exists "Users can delete own installment receipts" on public.installment_receipts;

drop table if exists public.installment_receipts;
