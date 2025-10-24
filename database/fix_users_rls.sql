-- 修复users表的RLS策略，允许匿名用户创建和更新用户记录
-- 这个脚本需要在Supabase SQL编辑器中运行

-- 1. 删除现有的RLS策略
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can delete own data" ON users;

-- 2. 创建新的RLS策略，允许匿名用户操作
-- 允许匿名用户插入用户记录（注册时）
CREATE POLICY "Allow anonymous user creation" ON users
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- 允许匿名用户查看用户记录（登录验证时）
CREATE POLICY "Allow anonymous user read" ON users
    FOR SELECT
    TO anon
    USING (true);

-- 允许匿名用户更新用户记录（设置密码时）
CREATE POLICY "Allow anonymous user update" ON users
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- 3. 确保RLS已启用
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. 验证策略是否创建成功
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users';
