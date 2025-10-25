-- 最终RLS策略修复
-- 这个脚本需要在Supabase SQL编辑器中运行

-- 1. 删除所有现有的RLS策略
DROP POLICY IF EXISTS "Users can manage own domains" ON domains;
DROP POLICY IF EXISTS "Users can manage own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Allow domain creation via email verification" ON domains;
DROP POLICY IF EXISTS "Allow domain read via email verification" ON domains;
DROP POLICY IF EXISTS "Allow domain update via email verification" ON domains;
DROP POLICY IF EXISTS "Allow domain delete via email verification" ON domains;
DROP POLICY IF EXISTS "Allow transaction creation via email verification" ON domain_transactions;
DROP POLICY IF EXISTS "Allow transaction read via email verification" ON domain_transactions;
DROP POLICY IF EXISTS "Allow transaction update via email verification" ON domain_transactions;
DROP POLICY IF EXISTS "Allow transaction delete via email verification" ON domain_transactions;
DROP POLICY IF EXISTS "Users can view own domains" ON domains;
DROP POLICY IF EXISTS "Users can insert own domains" ON domains;
DROP POLICY IF EXISTS "Users can update own domains" ON domains;
DROP POLICY IF EXISTS "Users can delete own domains" ON domains;
DROP POLICY IF EXISTS "Users can view own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON domain_transactions;

-- 2. 创建新的RLS策略 - 使用更宽松的策略进行测试
CREATE POLICY "Allow all operations for authenticated users" ON domains
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all operations for authenticated users" ON domain_transactions
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 3. 确保RLS已启用
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_transactions ENABLE ROW LEVEL SECURITY;

-- 4. 验证策略是否创建成功
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('domains', 'domain_transactions')
ORDER BY tablename, policyname;

-- 5. 测试当前用户状态
SELECT 'Current auth user:' as info, auth.uid() as user_id;
SELECT 'Users in public.users:' as info, COUNT(*) FROM public.users;
SELECT 'Users in auth.users:' as info, COUNT(*) FROM auth.users;
