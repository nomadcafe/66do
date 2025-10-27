-- 临时禁用RLS以解决400错误
-- 这是一个快速修复方案，用于解决立即的访问问题

-- 1. 禁用所有相关表的RLS
ALTER TABLE public.domains DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transactions DISABLE ROW LEVEL SECURITY;

-- 2. 如果renewal_cost_history表存在，也禁用它
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'renewal_cost_history' AND table_schema = 'public') THEN
    ALTER TABLE public.renewal_cost_history DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS for renewal_cost_history table';
  END IF;
END $$;

-- 3. 验证RLS已禁用
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions', 'renewal_cost_history');

-- 4. 显示结果
SELECT 
  CASE 
    WHEN rowsecurity THEN 'RLS ENABLED' 
    ELSE 'RLS DISABLED' 
  END as status,
  tablename
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions', 'renewal_cost_history');
