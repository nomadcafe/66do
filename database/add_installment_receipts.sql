-- installment_receipts: one row per real cash receipt against an installment sale.
-- Replaces the denormalized `paid_periods` counter on domain_transactions with
-- per-period audit records (real received_date, real amount). Negative amounts
-- represent refunds (interrupted installments).
--
-- Currency / FX:
--   Receipts inherit the parent sell transaction's currency. The receipt row
--   carries amount + date only; report code joins back to the parent sell to
--   apply fee/FX. Keeping receipts currency-less avoids parent/child drift.
--
-- RLS:
--   Mirror domain_transactions: full owner CRUD via auth.uid() = user_id.

create table if not exists public.installment_receipts (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.domain_transactions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  received_date date not null,
  amount numeric(12,2) not null,
  period_no integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists installment_receipts_tx_date_idx
  on public.installment_receipts (transaction_id, received_date);
create index if not exists installment_receipts_user_idx
  on public.installment_receipts (user_id);

alter table public.installment_receipts enable row level security;

drop policy if exists "Users can view own installment receipts" on public.installment_receipts;
create policy "Users can view own installment receipts" on public.installment_receipts
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own installment receipts" on public.installment_receipts;
create policy "Users can insert own installment receipts" on public.installment_receipts
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own installment receipts" on public.installment_receipts;
create policy "Users can update own installment receipts" on public.installment_receipts
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own installment receipts" on public.installment_receipts;
create policy "Users can delete own installment receipts" on public.installment_receipts
  for delete using (auth.uid() = user_id);

-- Backfill: synthesize N receipts for every installment sell with paid_periods > 0.
-- Uses installment_first_payment_date as the anchor when present, otherwise
-- falls back to (sell.date + 1 month) — the same approximation expandSellToCashReceipts
-- used before this migration, so report numbers stay continuous.
-- Idempotent: skips any sell that already has at least one receipt row.
with plans as (
  select
    dt.id as tx_id,
    dt.user_id,
    coalesce(dt.installment_amount, 0) as installment_amount,
    coalesce(dt.paid_periods, 0) as paid_periods,
    coalesce(
      dt.installment_first_payment_date,
      (dt.date::date + interval '1 month')::date
    ) as first_pay_date
  from public.domain_transactions dt
  where dt.type = 'sell'
    and dt.payment_plan = 'installment'
    and coalesce(dt.paid_periods, 0) > 0
)
insert into public.installment_receipts
  (transaction_id, user_id, received_date, amount, period_no, notes)
select
  p.tx_id,
  p.user_id,
  (p.first_pay_date + ((s.period - 1) || ' months')::interval)::date,
  p.installment_amount,
  s.period,
  'Backfilled from paid_periods'
from plans p
cross join lateral generate_series(1, p.paid_periods) as s(period)
where not exists (
  select 1 from public.installment_receipts ir
  where ir.transaction_id = p.tx_id
);

-- Drop the now-redundant counter column. Report and UI code reads
-- count(*) over installment_receipts instead.
alter table public.domain_transactions drop column if exists paid_periods;
