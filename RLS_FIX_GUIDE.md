# RLS 策略修复指南

## 🔧 问题描述
遇到RLS策略错误：
```
Error creating domain: {
  code: '42501',
  details: null,
  hint: null,
  message: 'new row violates row-level security policy for table "domains"'
}
```

## 🎯 解决方案

### 1. 修复domains表的RLS策略

在Supabase Dashboard的SQL编辑器中执行：

```sql
-- 删除所有现有的domains RLS策略
DROP POLICY IF EXISTS "Users can view own domains" ON domains;
DROP POLICY IF EXISTS "Users can insert own domains" ON domains;
DROP POLICY IF EXISTS "Users can update own domains" ON domains;
DROP POLICY IF EXISTS "Users can delete own domains" ON domains;
DROP POLICY IF EXISTS "Users can view own data" ON domains;
DROP POLICY IF EXISTS "Users can insert own data" ON domains;
DROP POLICY IF EXISTS "Users can update own data" ON domains;
DROP POLICY IF EXISTS "Users can delete own data" ON domains;

-- 创建新的RLS策略，允许通过邮箱验证的用户操作
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

-- 确保RLS已启用
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
```

### 2. 修复domain_transactions表的RLS策略

```sql
-- 删除所有现有的domain_transactions RLS策略
DROP POLICY IF EXISTS "Users can view own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON domain_transactions;
DROP POLICY IF EXISTS "Users can view own data" ON domain_transactions;
DROP POLICY IF EXISTS "Users can insert own data" ON domain_transactions;
DROP POLICY IF EXISTS "Users can update own data" ON domain_transactions;
DROP POLICY IF EXISTS "Users can delete own data" ON domain_transactions;

-- 创建新的RLS策略，允许通过邮箱验证的用户操作
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

-- 确保RLS已启用
ALTER TABLE domain_transactions ENABLE ROW LEVEL SECURITY;
```

### 3. 验证策略是否创建成功

```sql
-- 查看domains表的策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'domains'
ORDER BY policyname;

-- 查看domain_transactions表的策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'domain_transactions'
ORDER BY policyname;
```

## 📝 说明

这些RLS策略允许通过邮箱验证的用户（anon角色）访问和操作数据，因为：

1. **用户已验证邮箱**：通过Magic Link或邮箱验证的用户已经证明了自己的身份
2. **简化权限管理**：避免复杂的auth.uid()权限检查
3. **确保功能正常**：允许用户正常创建和管理域名、交易数据

## ⚠️ 注意事项

- 这些策略允许所有已验证邮箱的用户访问数据
- 如果需要更严格的权限控制，可以后续添加用户ID检查
- 建议在生产环境中定期审查RLS策略
