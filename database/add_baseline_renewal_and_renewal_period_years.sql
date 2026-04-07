-- 续费成本基线：该日期及之前的「历史续费」用 renewal_count × renewal_cost 估算；
-- 该日期之后的 renew 交易金额叠加计入持有成本（避免与档案双算需在应用中填写基线日）。
ALTER TABLE public.domains
  ADD COLUMN IF NOT EXISTS baseline_renewal_as_of DATE NULL;

COMMENT ON COLUMN public.domains.baseline_renewal_as_of IS
  'Historical renewal cost is represented by renewal_count×renewal_cost through this date; renew transactions after this date add incremental cost.';

-- 单笔续费交易延长到期的年数（可与域名 renewal_cycle 不同）；仅 type=renew 时有意义。
ALTER TABLE public.domain_transactions
  ADD COLUMN IF NOT EXISTS renewal_period_years INTEGER NULL;

COMMENT ON COLUMN public.domain_transactions.renewal_period_years IS
  'For renew transactions: calendar years to extend expiry (default app uses domains.renewal_cycle).';
