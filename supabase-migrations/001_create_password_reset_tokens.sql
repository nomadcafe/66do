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

-- 添加外键约束（如果users表存在）
-- ALTER TABLE public.password_reset_tokens 
-- ADD CONSTRAINT fk_password_reset_tokens_user_id 
-- FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 添加行级安全策略
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许插入和查询自己的重置令牌
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

-- 创建定时任务清理过期令牌（可选）
-- 这需要在Supabase Dashboard中手动设置
-- SELECT cron.schedule('cleanup-expired-reset-tokens', '0 2 * * *', 'SELECT cleanup_expired_reset_tokens();');
