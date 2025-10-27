-- 简化RLS修复 - 解决400错误
-- 在Supabase SQL编辑器中运行此脚本

-- 1. 临时禁用RLS以测试
ALTER TABLE public.domains DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transactions DISABLE ROW LEVEL SECURITY;

-- 2. 重新启用RLS
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transactions ENABLE ROW LEVEL SECURITY;

-- 3. 删除所有现有策略
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

-- 4. 创建最简单的RLS策略
CREATE POLICY "Allow all for authenticated users" ON public.domains
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.domain_transactions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. 验证
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions');
