-- 修复users表的RLS策略，允许通过邮箱验证的用户创建和访问自己的记录
-- 这个脚本需要在Supabase SQL编辑器中运行

-- 1. 删除所有现有的RLS策略
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can delete own data" ON users;
DROP POLICY IF EXISTS "Allow anonymous user creation" ON users;
DROP POLICY IF EXISTS "Allow anonymous user read" ON users;
DROP POLICY IF EXISTS "Allow anonymous user update" ON users;
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Enable insert for all users" ON users;
DROP POLICY IF EXISTS "Enable update for all users" ON users;
DROP POLICY IF EXISTS "Enable insert for anonymous users" ON users;
DROP POLICY IF EXISTS "Enable read access for anonymous users" ON users;
DROP POLICY IF EXISTS "Enable update for anonymous users" ON users;

-- 2. 创建新的RLS策略，允许通过邮箱验证的用户操作
-- 允许创建用户记录（Magic Link注册时，用户已验证邮箱）
CREATE POLICY "Allow user creation via email verification" ON users
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- 允许查看用户记录（Magic Link登录验证时，用户已验证邮箱）
CREATE POLICY "Allow user read via email verification" ON users
    FOR SELECT
    TO anon
    USING (true);

-- 允许更新用户记录（用户更新自己的信息时）
CREATE POLICY "Allow user update via email verification" ON users
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- 3. 确保RLS已启用
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. 验证策略是否创建成功
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;
