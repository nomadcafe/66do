-- Add installment first-payment date to domain_transactions (Supabase).
--
-- 为什么需要：旧实现把分期销售的全部已收款都按 t.date 月份归类，导致
-- Monthly Cash Flow 与累计 Revenue 在销售月单点 spike、之后几个月全 0。
-- expandSellToCashReceipts 已经按 "t.date + N 个月" 近似把已付期摊到对应
-- 月份，但首期付款日不一定 == 销售日（很多平台首期是 30 天后），所以再
-- 加一个可空的首期日字段：填了用它当基准，没填回退到近似。
--
-- 对旧数据无破坏：列允许 NULL，helper 会 fallback。

ALTER TABLE domain_transactions
  ADD COLUMN IF NOT EXISTS installment_first_payment_date DATE;
