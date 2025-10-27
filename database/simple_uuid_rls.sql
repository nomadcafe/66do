-- 简化的UUID RLS策略
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

-- 3. 创建简化的RLS策略 - 使用UUID直接比较
CREATE POLICY "Users can access own domains" ON public.domains
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can access own transactions" ON public.domain_transactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- 4. 验证设置
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions');

-- 5. 显示创建的策略
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
