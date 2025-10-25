# 密码重置功能设置指南

## 问题
当前系统提示 "Could not find the table 'public.password_reset_tokens' in the schema cache"，这是因为数据库中缺少密码重置令牌表。

## 解决方案

### 方法1：在Supabase Dashboard中手动创建表

1. 登录到 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目
3. 进入 **SQL Editor**
4. 复制并粘贴以下SQL代码：

```sql
-- 创建密码重置令牌表
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON public.password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- 添加行级安全策略
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许插入和查询重置令牌
CREATE POLICY "Users can insert their own reset tokens" ON public.password_reset_tokens
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own reset tokens" ON public.password_reset_tokens
    FOR SELECT USING (true);

-- 创建清理过期令牌的函数
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.password_reset_tokens 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

5. 点击 **Run** 执行SQL

### 方法2：使用脚本自动创建（需要Service Role Key）

如果您有Supabase的Service Role Key，可以运行：

```bash
# 安装依赖
npm install @supabase/supabase-js dotenv

# 运行设置脚本
node scripts/setup-password-reset-table.js
```

**注意**：需要在 `.env.local` 文件中添加：
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## 验证设置

创建表后，您可以通过以下方式验证：

1. 在Supabase Dashboard的 **Table Editor** 中查看 `password_reset_tokens` 表
2. 测试密码重置功能：
   - 访问 `/forgot-password`
   - 输入注册邮箱
   - 检查是否成功发送重置邮件

## 表结构说明

- `id`: 主键，自动生成的UUID
- `user_id`: 用户ID
- `token`: 重置令牌，唯一标识
- `email`: 用户邮箱
- `expires_at`: 令牌过期时间（1小时）
- `created_at`: 创建时间
- `used_at`: 使用时间（NULL表示未使用）

## 安全特性

- 令牌1小时后自动过期
- 一次性使用（使用后自动删除）
- 行级安全策略保护数据
- 自动清理过期令牌

设置完成后，密码重置功能就可以正常使用了！
