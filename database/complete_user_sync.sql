-- 完整的用户同步解决方案
-- 这个脚本需要在Supabase SQL编辑器中运行

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
-- 先处理可能存在的邮箱冲突
UPDATE public.users 
SET id = au.id
FROM auth.users au
WHERE public.users.email = au.email 
  AND public.users.id != au.id;

-- 然后插入不存在的用户
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
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  email_verified = EXCLUDED.email_verified,
  updated_at = EXCLUDED.updated_at;

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

-- 8. 验证策略是否创建成功
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('domains', 'domain_transactions')
ORDER BY tablename, policyname;

-- 9. 验证用户同步是否成功
SELECT 
  'auth.users' as source,
  COUNT(*) as user_count
FROM auth.users
UNION ALL
SELECT 
  'public.users' as source,
  COUNT(*) as user_count
FROM public.users;
