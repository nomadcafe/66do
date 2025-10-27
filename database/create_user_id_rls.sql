-- 为user_id字段创建RLS策略
-- 在Supabase SQL编辑器中运行此脚本

-- 1. 确保RLS已启用
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transactions ENABLE ROW LEVEL SECURITY;

-- 2. 删除所有现有策略
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 删除domains表的所有策略
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'domains' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.domains';
    END LOOP;
    
    -- 删除domain_transactions表的所有策略
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'domain_transactions' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.domain_transactions';
    END LOOP;
END $$;

-- 3. 为domains表创建RLS策略
CREATE POLICY "Users can view own domains" ON public.domains
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own domains" ON public.domains
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own domains" ON public.domains
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own domains" ON public.domains
  FOR DELETE USING (auth.uid()::text = user_id);

-- 4. 为domain_transactions表创建RLS策略
CREATE POLICY "Users can view own transactions" ON public.domain_transactions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own transactions" ON public.domain_transactions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own transactions" ON public.domain_transactions
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own transactions" ON public.domain_transactions
  FOR DELETE USING (auth.uid()::text = user_id);

-- 5. 验证RLS设置
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions');

-- 6. 显示创建的策略
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions')
ORDER BY tablename, policyname;
