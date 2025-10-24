-- Supabase数据库架构
-- 在Supabase Dashboard的SQL编辑器中运行此脚本

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 域名表
CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL,
  registrar TEXT,
  purchase_date DATE,
  purchase_cost DECIMAL(10,2),
  renewal_cost DECIMAL(10,2),
  renewal_cycle INTEGER DEFAULT 1,
  renewal_count INTEGER DEFAULT 0,
  next_renewal_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'for_sale', 'sold', 'expired')),
  estimated_value DECIMAL(10,2),
  sale_date DATE,
  sale_price DECIMAL(10,2),
  platform_fee DECIMAL(10,2),
  tags TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 交易表
CREATE TABLE IF NOT EXISTS domain_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'renewal', 'sell', 'marketing', 'advertising')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0,
  base_amount DECIMAL(10,2),
  platform_fee DECIMAL(10,2),
  platform_fee_percentage DECIMAL(5,2),
  net_amount DECIMAL(10,2),
  category TEXT,
  tax_deductible BOOLEAN DEFAULT FALSE,
  receipt_url TEXT,
  notes TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 验证令牌表
CREATE TABLE IF NOT EXISTS verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
CREATE INDEX IF NOT EXISTS idx_domains_expiry_date ON domains(expiry_date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON domain_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_domain_id ON domain_transactions(domain_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON domain_transactions(type);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_id ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表添加更新时间触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_domains_updated_at BEFORE UPDATE ON domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_domain_transactions_updated_at BEFORE UPDATE ON domain_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略 (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 用户只能访问自己的数据
CREATE POLICY "Users can view own data" ON users
    FOR ALL USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view own domains" ON domains
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view own transactions" ON domain_transactions
    FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view own verification tokens" ON verification_tokens
    FOR ALL USING (auth.uid()::text = user_id::text);
