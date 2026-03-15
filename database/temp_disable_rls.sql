-- 【仅调试用，勿在生产长期使用】临时禁用 RLS 进行测试。用后请重新启用 RLS。详见 database/README.md

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
