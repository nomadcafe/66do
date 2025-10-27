-- 快速启用RLS的SQL脚本
-- 在Supabase SQL编辑器中直接运行

-- 启用所有表的行级安全
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transactions ENABLE ROW LEVEL SECURITY;

-- 如果renewal_cost_history表存在，也启用RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'renewal_cost_history' AND table_schema = 'public') THEN
    ALTER TABLE public.renewal_cost_history ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 验证RLS是否已启用
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions', 'renewal_cost_history');
