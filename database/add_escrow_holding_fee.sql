-- 给 domain_transactions 加 escrow_holding_fee 列。
--
-- 背景
-- ----
-- Escrow 分期的「域名托管费」此前完全不可控：
--   1. 数据库没有这一列
--   2. dashboard 和 InstallmentConfig 两条调用路径都硬传 undefined
--   3. 计算器用 `domainHoldingFee > 0 ? 用它 : 自动估算` 判断，
--      连填 0 都会回退到自动值
-- 于是每笔 Escrow 分期都会被自动加上 `max(100, 标价×0.0001) × 期数` 的托管费，
-- 关不掉。一笔 15 万 / 24 期的交易凭空多出 2,400 —— 一笔谁都没付过的钱。
--
-- 语义（NULL 与 0 是两回事，不要用 0 当"未填"）
--   NULL  = 未记录 → 按 escrow_lease_type × 标价 × 期数自动估算（保持旧行为）
--   0     = 明确没有托管费
--   > 0   = 用户记录的实际金额，覆盖自动估算
--
-- 部署顺序：**先跑这段 SQL，再部署代码。**
-- （代码侧做了兜底：值为 NULL 时整个键不进 payload，所以即使先部署了代码、
--   只要没人去填这个字段，写入也不会因为「列不存在」而失败。但填了就会失败，
--   所以还是先跑 SQL。）

ALTER TABLE public.domain_transactions
  ADD COLUMN IF NOT EXISTS escrow_holding_fee numeric(12,2);

COMMENT ON COLUMN public.domain_transactions.escrow_holding_fee IS
  'Escrow 分期期间的域名托管费总额。NULL = 未记录（按 lease type × 标价 × 期数自动估算）；0 = 明确没有托管费；>0 = 实际金额。';

-- 存量行一律保持 NULL：它们此前就是走自动估算的，语义不变，不做任何追溯改动。

-- 核对
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'domain_transactions'
   AND column_name = 'escrow_holding_fee';
