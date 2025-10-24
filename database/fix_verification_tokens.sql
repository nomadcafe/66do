-- 修复verification_tokens表，支持email作为user_id
-- 在Supabase Dashboard的SQL编辑器中运行此脚本

-- 删除现有的verification_tokens表
DROP TABLE IF EXISTS verification_tokens CASCADE;

-- 重新创建verification_tokens表，user_id使用TEXT类型
CREATE TABLE verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- 改为TEXT类型，支持email
  token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_verification_tokens_user_id ON verification_tokens(user_id);
CREATE INDEX idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX idx_verification_tokens_expires_at ON verification_tokens(expires_at);

-- 启用行级安全策略
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略 - 允许所有操作（用于API）
CREATE POLICY "Allow all operations on verification_tokens" ON verification_tokens
    FOR ALL USING (true);
