-- 临时禁用RLS进行测试
-- 这个脚本需要在Supabase SQL编辑器中运行

-- 1. 临时禁用RLS
ALTER TABLE domains DISABLE ROW LEVEL SECURITY;
ALTER TABLE domain_transactions DISABLE ROW LEVEL SECURITY;

-- 2. 验证RLS状态
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('domains', 'domain_transactions');

-- 3. 测试插入（这应该能成功）
-- 注意：这只是一个测试，实际使用时需要重新启用RLS
