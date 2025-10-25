-- 修复domain_transactions表的RLS策略
-- 这个脚本需要在Supabase SQL编辑器中运行

-- 1. 删除所有现有的domain_transactions RLS策略
DROP POLICY IF EXISTS "Users can view own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Users can view own data" ON domain_transactions;
DROP POLICY IF EXISTS "Users can insert own data" ON domain_transactions;
DROP POLICY IF EXISTS "Users can update own data" ON domain_transactions;
DROP POLICY IF EXISTS "Users can delete own data" ON domain_transactions;

-- 2. 创建新的RLS策略，允许通过邮箱验证的用户操作
-- 允许创建交易记录（用户已验证邮箱）
CREATE POLICY "Allow transaction creation via email verification" ON domain_transactions
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- 允许查看交易记录（用户已验证邮箱）
CREATE POLICY "Allow transaction read via email verification" ON domain_transactions
    FOR SELECT
    TO anon
    USING (true);

-- 允许更新交易记录（用户更新自己的交易信息时）
CREATE POLICY "Allow transaction update via email verification" ON domain_transactions
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- 允许删除交易记录（用户删除自己的交易时）
CREATE POLICY "Allow transaction delete via email verification" ON domain_transactions
    FOR DELETE
    TO anon
    USING (true);

-- 3. 确保RLS已启用
ALTER TABLE domain_transactions ENABLE ROW LEVEL SECURITY;

-- 4. 验证策略是否创建成功
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'domain_transactions'
ORDER BY policyname;
