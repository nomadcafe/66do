-- 【仅调试用，勿在生产长期使用】临时禁用 RLS 以解决 400 错误。
-- 用后请尽快执行 enable_rls_when_ready.sql 或对应 fix_*_rls.sql 重新启用 RLS。
-- 详见 database/README.md

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
