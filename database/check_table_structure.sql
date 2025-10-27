-- 检查表结构
-- 查看domains和domain_transactions表的实际字段

-- 1. 检查domains表结构
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'domains' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 检查domain_transactions表结构
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'domain_transactions' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 检查是否有user_id字段
SELECT 
    table_name,
    column_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND (column_name LIKE '%user%' OR column_name LIKE '%owner%')
ORDER BY table_name, column_name;
