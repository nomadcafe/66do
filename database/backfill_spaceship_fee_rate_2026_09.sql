-- 2026-09：Spaceship 平台费率从 5% 调整为 10%（分期与一口价同）。
--
-- 为什么需要这个回填
-- ------------------
-- 分期交易的平台费不是存下来的，是每次渲染时算的：
--     平台费 = 分期总售价 × 费率 × 已付比例
-- 费率作用在**整笔交易**上，不是逐期计算。所以只把代码里的默认费率从 5%
-- 改成 10%，会让所有历史 Spaceship 分期被追溯重新定价——包括已经收完的，
-- 以及正在收款那笔已经收到的部分。实测一笔总售价 14,000 的分期，平台费会
-- 从 700 变成 1,400，卖家净收入凭空少 700。
--
-- 修法是把费率记到每笔交易自己身上：代码现在优先采用
-- platform_fee_percentage，没有才落到当前默认值（10%）。所以调价之前，
-- 存量交易必须先被标上它们当初实际适用的 5%。
--
-- 顺序很重要：**先跑这段 SQL，再部署改了默认费率的代码。**
-- 反过来的话，中间那段时间里历史交易会显示成 10%。
--
-- 一口价（payment_plan 非 installment）不受影响：它们的 platform_fee 是
-- 存在交易行上的，渲染时直接用，不重算。这里不动它们。

-- ============================================================
-- 步骤 1：先看会影响哪些行（只读，先跑这个确认）
-- ============================================================
SELECT
  id,
  domain_id,
  date,
  amount,
  payment_plan,
  installment_period,
  platform_fee_percentage AS current_rate_pct
FROM public.domain_transactions
WHERE platform_fee_type = 'spaceship_installment'
  AND date < DATE '2026-09-01'
ORDER BY date;

-- 预期：所有 2026-09-01 之前成交的 Spaceship 分期，current_rate_pct 应为
-- NULL 或 0（此前没有记录过费率）。如果某行已经有非零值，说明它已被显式
-- 设定过，步骤 2 的 WHERE 条件会跳过它 —— 这是有意的，不要覆盖。

-- ============================================================
-- 步骤 2：回填 5%
-- ============================================================
UPDATE public.domain_transactions
   SET platform_fee_percentage = 5,
       updated_at = now()
 WHERE platform_fee_type = 'spaceship_installment'
   AND date < DATE '2026-09-01'
   AND (platform_fee_percentage IS NULL OR platform_fee_percentage = 0);

-- ============================================================
-- 步骤 3：核对
-- ============================================================
SELECT
  CASE WHEN date < DATE '2026-09-01' THEN 'pre-2026-09 (应为 5)'
       ELSE '2026-09 起 (应为空 → 走默认 10)' END AS cohort,
  platform_fee_percentage,
  COUNT(*) AS rows
FROM public.domain_transactions
WHERE platform_fee_type = 'spaceship_installment'
GROUP BY 1, 2
ORDER BY 1, 2;

-- 2026-09 之后成交的交易刻意留空：让它们跟随代码里的当前默认值。
-- 下次 Spaceship 再调价时，重复这套流程（把届时的 10% 回填给存量行，
-- 再改默认值），历史就不会被追溯重算。
