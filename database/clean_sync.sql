-- 清理并重新同步用户数据
-- 这个脚本需要在Supabase SQL编辑器中运行

-- 1. 临时禁用触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- 2. 清理public.users表中的重复数据
-- 删除所有记录，重新开始
DELETE FROM public.users;

-- 3. 重新插入所有auth.users中的用户
INSERT INTO public.users (id, email, password_hash, email_verified, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  '', -- Magic Link用户没有密码
  COALESCE(au.email_confirmed_at IS NOT NULL, false),
  au.created_at,
  au.updated_at
FROM auth.users au;

-- 4. 重新创建触发器
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

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

-- 6. 创建新的RLS策略
CREATE POLICY "Users can manage own domains" ON domains
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own transactions" ON domain_transactions
    FOR ALL USING (auth.uid() = user_id);

-- 7. 确保RLS已启用
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_transactions ENABLE ROW LEVEL SECURITY;

-- 8. 验证结果
SELECT 'Sync completed successfully!' as status;
SELECT 'auth.users count:' as info, COUNT(*) FROM auth.users;
SELECT 'public.users count:' as info, COUNT(*) FROM public.users;
SELECT 'Matching users:' as info, COUNT(*) 
FROM auth.users au
JOIN public.users pu ON au.id = pu.id;
