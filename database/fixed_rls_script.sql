-- 修复的RLS脚本 - 使用正确的字段名
-- 在Supabase SQL编辑器中运行此脚本

-- 1. 首先检查表结构
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('domains', 'domain_transactions')
  AND (column_name LIKE '%user%' OR column_name LIKE '%owner%')
ORDER BY table_name, column_name;

-- 2. 临时禁用RLS
ALTER TABLE public.domains DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transactions DISABLE ROW LEVEL SECURITY;

-- 3. 重新启用RLS
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_transactions ENABLE ROW LEVEL SECURITY;

-- 4. 删除所有现有策略
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

-- 5. 创建基于user_id的RLS策略（如果字段存在）
-- 首先检查字段是否存在
DO $$
BEGIN
    -- 检查domains表是否有user_id字段
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'domains' 
          AND table_schema = 'public' 
          AND column_name = 'user_id'
    ) THEN
        -- 创建基于user_id的策略
        CREATE POLICY "Users can access own domains" ON public.domains
          FOR ALL TO authenticated
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
        
        RAISE NOTICE 'Created RLS policy for domains using user_id field';
    ELSE
        -- 如果没有user_id字段，创建允许所有认证用户的策略
        CREATE POLICY "Allow all for authenticated users" ON public.domains
          FOR ALL TO authenticated
          USING (true)
          WITH CHECK (true);
        
        RAISE NOTICE 'Created open RLS policy for domains (no user_id field found)';
    END IF;
    
    -- 检查domain_transactions表是否有user_id字段
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'domain_transactions' 
          AND table_schema = 'public' 
          AND column_name = 'user_id'
    ) THEN
        -- 创建基于user_id的策略
        CREATE POLICY "Users can access own transactions" ON public.domain_transactions
          FOR ALL TO authenticated
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
        
        RAISE NOTICE 'Created RLS policy for domain_transactions using user_id field';
    ELSE
        -- 如果没有user_id字段，创建允许所有认证用户的策略
        CREATE POLICY "Allow all for authenticated users" ON public.domain_transactions
          FOR ALL TO authenticated
          USING (true)
          WITH CHECK (true);
        
        RAISE NOTICE 'Created open RLS policy for domain_transactions (no user_id field found)';
    END IF;
END $$;

-- 6. 验证设置
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public' 
  AND tablename IN ('domains', 'domain_transactions');

-- 7. 显示创建的策略
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
