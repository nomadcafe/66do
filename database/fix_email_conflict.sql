-- 修复邮箱冲突问题
-- 这个脚本需要在Supabase SQL编辑器中运行

-- 1. 检查当前的数据状态
SELECT 'Current users in auth.users:' as info;
SELECT id, email, email_confirmed_at, created_at FROM auth.users;

SELECT 'Current users in public.users:' as info;
SELECT id, email, email_verified, created_at FROM public.users;

-- 2. 处理邮箱冲突 - 删除重复的邮箱记录（保留auth.users中的记录）
DELETE FROM public.users 
WHERE email IN (
  SELECT email 
  FROM public.users 
  WHERE id NOT IN (SELECT id FROM auth.users)
);

-- 3. 更新现有用户的ID以匹配auth.users
UPDATE public.users 
SET 
  id = au.id,
  email_verified = COALESCE(au.email_confirmed_at IS NOT NULL, false),
  updated_at = au.updated_at
FROM auth.users au
WHERE public.users.email = au.email 
  AND public.users.id != au.id;

-- 4. 插入不存在的用户记录
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

-- 5. 验证同步结果
SELECT 'After sync - auth.users count:' as info;
SELECT COUNT(*) FROM auth.users;

SELECT 'After sync - public.users count:' as info;
SELECT COUNT(*) FROM public.users;

SELECT 'Users with matching IDs:' as info;
SELECT COUNT(*) 
FROM auth.users au
JOIN public.users pu ON au.id = pu.id;

-- 6. 检查是否还有邮箱冲突
SELECT 'Email conflicts (should be 0):' as info;
SELECT COUNT(*) 
FROM (
  SELECT email, COUNT(*) as count
  FROM public.users 
  GROUP BY email 
  HAVING COUNT(*) > 1
) conflicts;
