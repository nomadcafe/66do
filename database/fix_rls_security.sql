-- 修复RLS安全问题的SQL脚本
-- 解决Supabase数据库linter报告的安全问题

-- 1. 启用所有表的行级安全
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewal_cost_history ENABLE ROW LEVEL SECURITY;

-- 2. 删除可能存在的旧策略（如果存在）
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.domains;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.domain_transactions;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.renewal_cost_history;

-- 3. 为domains表创建正确的RLS策略
CREATE POLICY "Users can view own domains" ON public.domains
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own domains" ON public.domains
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own domains" ON public.domains
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own domains" ON public.domains
  FOR DELETE USING (auth.uid() = owner_user_id);

-- 4. 为domain_transactions表创建正确的RLS策略
CREATE POLICY "Users can view own transactions" ON public.domain_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.domains 
      WHERE domains.id = domain_transactions.domain_id 
      AND domains.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own transactions" ON public.domain_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.domains 
      WHERE domains.id = domain_transactions.domain_id 
      AND domains.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own transactions" ON public.domain_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.domains 
      WHERE domains.id = domain_transactions.domain_id 
      AND domains.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own transactions" ON public.domain_transactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.domains 
      WHERE domains.id = domain_transactions.domain_id 
      AND domains.owner_user_id = auth.uid()
    )
  );

-- 5. 为renewal_cost_history表创建RLS策略（如果表存在）
-- 首先检查表是否存在，如果存在则创建策略
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'renewal_cost_history' AND table_schema = 'public') THEN
    -- 创建renewal_cost_history的RLS策略
    CREATE POLICY "Users can view own renewal cost history" ON public.renewal_cost_history
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.domains 
          WHERE domains.id = renewal_cost_history.domain_id 
          AND domains.owner_user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can insert own renewal cost history" ON public.renewal_cost_history
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.domains 
          WHERE domains.id = renewal_cost_history.domain_id 
          AND domains.owner_user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can update own renewal cost history" ON public.renewal_cost_history
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.domains 
          WHERE domains.id = renewal_cost_history.domain_id 
          AND domains.owner_user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can delete own renewal cost history" ON public.renewal_cost_history
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.domains 
          WHERE domains.id = renewal_cost_history.domain_id 
          AND domains.owner_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 6. 验证RLS是否已启用
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions', 'renewal_cost_history');

-- 7. 验证策略是否已创建
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions', 'renewal_cost_history')
ORDER BY tablename, policyname;
