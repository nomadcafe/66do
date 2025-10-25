-- 简化用户架构，直接使用Supabase auth.users
-- 这个脚本需要在Supabase SQL编辑器中运行

-- 1. 删除自定义users表（如果存在）
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. 修改domains表，直接引用auth.users
ALTER TABLE public.domains 
DROP CONSTRAINT IF EXISTS domains_user_id_fkey;

ALTER TABLE public.domains 
ADD CONSTRAINT domains_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. 修改domain_transactions表，直接引用auth.users
ALTER TABLE public.domain_transactions 
DROP CONSTRAINT IF EXISTS domain_transactions_user_id_fkey;

ALTER TABLE public.domain_transactions 
ADD CONSTRAINT domain_transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. 删除现有的RLS策略
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

-- 5. 创建新的RLS策略，使用auth.uid()
CREATE POLICY "Users can manage own domains" ON domains
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own transactions" ON domain_transactions
    FOR ALL USING (auth.uid() = user_id);

-- 6. 确保RLS已启用
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_transactions ENABLE ROW LEVEL SECURITY;

-- 7. 验证策略是否创建成功
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('domains', 'domain_transactions')
ORDER BY tablename, policyname;
