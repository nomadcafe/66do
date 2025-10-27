-- 紧急修复RLS问题
-- 解决400错误，确保用户可以访问自己的数据

-- 1. 首先禁用RLS（临时）
ALTER TABLE public.domains DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transactions DISABLE ROW LEVEL SECURITY;

-- 2. 重新启用RLS
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transactions ENABLE ROW LEVEL SECURITY;

-- 3. 删除所有现有策略
DROP POLICY IF EXISTS "Users can view own domains" ON public.domains;
DROP POLICY IF EXISTS "Users can insert own domains" ON public.domains;
DROP POLICY IF EXISTS "Users can update own domains" ON public.domains;
DROP POLICY IF EXISTS "Users can delete own domains" ON public.domains;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.domain_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.domain_transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.domain_transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.domain_transactions;

-- 4. 创建简化的RLS策略
-- 允许认证用户访问自己的数据
CREATE POLICY "Authenticated users can access own domains" ON public.domains
  FOR ALL USING (auth.uid() = owner_user_id);

CREATE POLICY "Authenticated users can access own transactions" ON public.domain_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.domains 
      WHERE domains.id = domain_transactions.domain_id 
      AND domains.owner_user_id = auth.uid()
    )
  );

-- 5. 验证设置
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions');

-- 6. 显示策略
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions');
