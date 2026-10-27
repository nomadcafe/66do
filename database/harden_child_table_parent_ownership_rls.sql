-- 子表 RLS 补上「父行也必须是你的」这一条。
--
-- APPLIED: 2026-10-27. Recorded in schema_migrations the same day.
--
-- 背景：
--   domain_transactions 和 installment_receipts 的策略只检查行自己的
--   user_id = auth.uid()。至于它挂在谁的父行上——交易的 domain_id、收款的
--   transaction_id——只在 API 层查（app/api/transactions/route.ts 的
--   getOwnedDomainIds / isDomainOwnedByUser，app/api/installment-receipts/
--   route.ts 的父交易归属检查）。
--
--   但浏览器手里本来就有 anon key + 用户自己的 JWT，可以绕开 /api/* 直接打
--   PostgREST。这时唯一的防线是 RLS，于是一个登录用户可以写入
--   `user_id = 自己, domain_id = 别人的域名` 的交易行，或者把收款挂到别人的
--   交易上。
--
--   实际危害有限：要先拿到对方的随机 UUID，且写进去的行受害者读不到（SELECT
--   仍按 user_id 过滤）。但「归属规则只活在 API 里」本身就是隐患——以后哪条
--   客户端写入路径绕过 API，这个检查就静默消失。renewal_cost_history 当年就
--   是按父表 domains.user_id 做的跨表检查，这里补齐同一个模式。
--
-- 改了什么：
--   只动 WITH CHECK（新写入 / 更新后的行），USING 不变，所以读取和删除行为
--   与现在完全一致。
--   - domain_transactions："Users can access own transactions"（FOR ALL）
--       WITH CHECK 加上 domain_id 必须指向自己的 domains 行
--   - installment_receipts：insert / update 两条策略
--       WITH CHECK 加上 transaction_id 必须指向自己的 domain_transactions 行
--
-- 执行顺序：
--   1. 先跑「步骤 1」的两条预检。都应返回 0 行。不是 0 的话说明库里已有跨用户
--      引用的行——这些行在本迁移后将无法再被 UPDATE（WITH CHECK 会拒），先人工
--      处理再继续。
--   2. 跑步骤 2。纯策略变更，不改代码，无需配合部署：所有正常写入路径本来就
--      满足新条件（API 层已经强制）。
--   3. 跑步骤 3 核对。

-- ============================================================
-- 步骤 1：预检——两条都应该返回 0 行
-- ============================================================
SELECT t.id, t.user_id, t.domain_id
FROM public.domain_transactions t
LEFT JOIN public.domains d ON d.id = t.domain_id
WHERE d.id IS NULL OR d.user_id <> t.user_id;

SELECT r.id, r.user_id, r.transaction_id
FROM public.installment_receipts r
LEFT JOIN public.domain_transactions t ON t.id = r.transaction_id
WHERE t.id IS NULL OR t.user_id <> r.user_id;

-- ============================================================
-- 步骤 2：收紧 WITH CHECK
-- ============================================================
ALTER POLICY "Users can access own transactions" ON public.domain_transactions
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.domains d
      WHERE d.id = domain_transactions.domain_id
        AND d.user_id = auth.uid()
    )
  );

ALTER POLICY "Users can insert own installment receipts" ON public.installment_receipts
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.domain_transactions t
      WHERE t.id = installment_receipts.transaction_id
        AND t.user_id = auth.uid()
    )
  );

ALTER POLICY "Users can update own installment receipts" ON public.installment_receipts
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.domain_transactions t
      WHERE t.id = installment_receipts.transaction_id
        AND t.user_id = auth.uid()
    )
  );

-- ============================================================
-- 步骤 3：核对——三条策略的 with_check 里都应出现 EXISTS
-- ============================================================
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('domain_transactions', 'installment_receipts')
ORDER BY tablename, policyname;

INSERT INTO public.schema_migrations (filename, notes)
VALUES (
  'harden_child_table_parent_ownership_rls.sql',
  'Child-table RLS WITH CHECK now also requires the parent row (domain / transaction) to be owned by auth.uid().'
)
ON CONFLICT (filename) DO NOTHING;
