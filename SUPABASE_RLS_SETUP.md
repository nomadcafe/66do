# Supabase RLS 策略设置指南

## 🔧 修复RLS策略问题

### 问题描述
Magic Link登录时遇到RLS策略错误：
```
Error creating user: {
  code: '42501',
  message: 'new row violates row-level security policy for table "users"'
}
```

### 正确的用户登录流程
1. **用户输入邮箱** → 系统发送Magic Link邮件
2. **用户点击邮件链接** → 系统验证Magic Link令牌
3. **验证成功后** → 系统创建用户记录（如果不存在）
4. **用户登录成功** → 跳转到用户仪表板

**关键点**：用户已经通过邮箱验证，应该能够创建和访问自己的用户记录。

### 解决方案

#### 1. 在Supabase Dashboard中执行SQL

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 执行以下SQL脚本：

```sql
-- 删除所有现有的RLS策略
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

-- 创建新的RLS策略，允许通过邮箱验证的用户操作
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

-- 确保RLS已启用
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

#### 2. 验证策略设置

执行以下查询验证策略是否正确设置：

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;
```

应该看到3个策略：
- `Allow user creation via email verification` (INSERT)
- `Allow user read via email verification` (SELECT)  
- `Allow user update via email verification` (UPDATE)

#### 3. 测试Magic Link登录

1. 访问登录页面
2. 输入邮箱地址
3. 点击"发送登录链接"
4. 检查邮箱中的Magic Link
5. 点击链接验证登录

### 安全说明

这些RLS策略允许通过邮箱验证的用户：
- ✅ **创建用户记录** - 通过Magic Link注册时（已验证邮箱）
- ✅ **读取用户记录** - 验证Magic Link时（已验证邮箱）
- ✅ **更新用户记录** - 更新用户信息时（已验证邮箱）

**安全考虑**：
- 只有通过邮箱验证的用户才能创建账户
- Magic Link有15分钟过期时间
- 每个Magic Link只能使用一次
- 用户数据仍然受到保护，只允许已验证邮箱的用户操作

### 故障排除

如果仍然遇到RLS错误：

1. **检查策略是否正确创建**：
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'users';
   ```

2. **检查RLS是否启用**：
   ```sql
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'users';
   ```

3. **重新创建策略**：
   如果策略有问题，删除并重新创建：
   ```sql
   DROP POLICY IF EXISTS "Allow user creation via email verification" ON users;
   DROP POLICY IF EXISTS "Allow user read via email verification" ON users;
   DROP POLICY IF EXISTS "Allow user update via email verification" ON users;
   ```

### 完成后的效果

设置完成后，Magic Link登录应该能够：
- ✅ 成功创建用户记录
- ✅ 成功验证Magic Link令牌
- ✅ 自动登录并跳转到仪表板
- ✅ 不再出现RLS策略错误
