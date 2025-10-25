# 用户同步问题修复指南

## 🔧 问题描述
Magic Link认证创建的用户在Supabase的`auth.users`表中，但应用使用的是自定义的`users`表，导致外键约束失败：

```
Error creating domain: {
  code: '23503',
  details: 'Key is not present in table "users".',
  hint: null,
  message: 'insert or update on table "domains" violates foreign key constraint "domains_user_id_fkey"'
}
```

## 🎯 解决方案

### 方案1：用户同步（推荐）
保留自定义`users`表，通过触发器自动同步Supabase认证用户数据。这样可以：
- ✅ 保留自定义用户字段的扩展性
- ✅ 自动同步认证用户数据
- ✅ 支持未来业务需求扩展
- ✅ 完全控制用户数据结构

#### 在Supabase Dashboard中执行以下SQL：

```sql
-- 1. 创建函数来自动同步auth.users到users表
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, password_hash, email_verified, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    '', -- Magic Link用户没有密码
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    updated_at = NEW.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 创建触发器，当auth.users中有新用户时自动创建users表记录
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. 创建更新触发器，当auth.users更新时同步到users表
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users 
  SET 
    email = NEW.email,
    email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    updated_at = NEW.updated_at
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- 4. 为现有用户创建记录（如果还没有的话）
INSERT INTO public.users (id, email, password_hash, email_verified, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  '', -- Magic Link用户没有密码
  COALESCE(au.email_confirmed_at IS NOT NULL, false),
  au.created_at,
  au.updated_at
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5. 删除现有的RLS策略
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

-- 6. 创建新的RLS策略，使用auth.uid()
CREATE POLICY "Users can manage own domains" ON domains
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own transactions" ON domain_transactions
    FOR ALL USING (auth.uid() = user_id);

-- 7. 确保RLS已启用
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_transactions ENABLE ROW LEVEL SECURITY;
```

### 方案2：简化架构（备选）
直接使用Supabase的`auth.users`表，删除自定义的`users`表。适合简单应用场景。

## 📋 验证步骤

1. **执行SQL脚本**：在Supabase Dashboard的SQL编辑器中运行上述脚本
2. **测试Magic Link登录**：尝试使用Magic Link登录
3. **测试创建域名**：登录后尝试创建一个域名
4. **检查RLS策略**：确保用户只能访问自己的数据

## ⚠️ 如果遇到邮箱冲突错误

如果执行时遇到 `duplicate key value violates unique constraint "users_email_key"` 错误：

### 快速解决方案
执行 `database/clean_sync.sql` 脚本，它会：
1. 清理所有重复数据
2. 重新同步用户数据
3. 重新创建触发器
4. 设置正确的RLS策略

### 手动解决步骤
1. 在Supabase Dashboard中执行：
```sql
-- 临时禁用触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- 清理重复数据
DELETE FROM public.users;

-- 重新同步
INSERT INTO public.users (id, email, password_hash, email_verified, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  '',
  COALESCE(au.email_confirmed_at IS NOT NULL, false),
  au.created_at,
  au.updated_at
FROM auth.users au;
```

## ⚠️ 注意事项

- **方案1（推荐）**：更简单，直接使用Supabase的认证系统
- **方案2（备选）**：如果需要自定义用户字段，可以使用同步方案
- **数据备份**：在执行任何架构更改前，建议备份重要数据
- **测试环境**：建议先在测试环境中验证更改

## 🔍 故障排除

如果仍然遇到问题，请检查：

1. **RLS策略是否正确**：确保策略使用`auth.uid() = user_id`
2. **外键约束**：确保外键指向正确的表
3. **用户认证状态**：确保用户已正确登录
4. **数据库权限**：确保应用有正确的数据库权限
