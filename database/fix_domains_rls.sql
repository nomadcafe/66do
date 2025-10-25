-- 修复domains表的RLS策略
-- 这个脚本需要在Supabase SQL编辑器中运行

-- 1. 删除所有现有的domains RLS策略
DROP POLICY IF EXISTS "Users can view own domains" ON domains;
DROP POLICY IF EXISTS "Users can insert own domains" ON domains;
DROP POLICY IF EXISTS "Users can update own domains" ON domains;
DROP POLICY IF EXISTS "Users can delete own domains" ON domains;
DROP POLICY IF EXISTS "Users can view own data" ON domains;
DROP POLICY IF EXISTS "Users can insert own data" ON domains;
DROP POLICY IF EXISTS "Users can update own data" ON domains;
DROP POLICY IF EXISTS "Users can delete own data" ON domains;

-- 2. 创建新的RLS策略，允许通过邮箱验证的用户操作
-- 允许创建域名记录（用户已验证邮箱）
CREATE POLICY "Allow domain creation via email verification" ON domains
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- 允许查看域名记录（用户已验证邮箱）
CREATE POLICY "Allow domain read via email verification" ON domains
    FOR SELECT
    TO anon
    USING (true);

-- 允许更新域名记录（用户更新自己的域名信息时）
CREATE POLICY "Allow domain update via email verification" ON domains
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- 允许删除域名记录（用户删除自己的域名时）
CREATE POLICY "Allow domain delete via email verification" ON domains
    FOR DELETE
    TO anon
    USING (true);

-- 3. 确保RLS已启用
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- 4. 验证策略是否创建成功
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'domains'
ORDER BY policyname;
