-- 66Do Database Schema
-- 智能投资管理平台数据库表结构

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 域名表
CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_name VARCHAR(255) UNIQUE NOT NULL,
  registrar VARCHAR(100),
  purchase_date DATE,
  purchase_cost DECIMAL(10, 2),
  renewal_cost DECIMAL(10, 2),
  renewal_cycle INTEGER DEFAULT 1, -- 续费周期（年数）：1, 2, 3等
  renewal_count INTEGER DEFAULT 0, -- 已续费次数
  next_renewal_date DATE,
  expiry_date DATE NOT NULL, -- 域名到期日期
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'for_sale', 'sold', 'expired')),
  estimated_value DECIMAL(10, 2),
  sale_date DATE, -- 出售日期
  sale_price DECIMAL(10, 2), -- 出售价格
  tags TEXT[] DEFAULT '{}',
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 交易记录表
CREATE TABLE IF NOT EXISTS domain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('buy', 'renew', 'sell', 'transfer', 'fee')),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  date DATE NOT NULL,
  notes TEXT,
  platform VARCHAR(100),
  transaction_time TIMESTAMP WITH TIME ZONE,
  gross_amount DECIMAL(10, 2),
  fee_percentage DECIMAL(5, 2),
  fee_amount DECIMAL(10, 2),
  payment_plan VARCHAR(20) CHECK (payment_plan IN ('lump_sum', 'installment')),
  installment_period INTEGER,
  installment_fee_percentage DECIMAL(5, 2),
  installment_fee_amount DECIMAL(10, 2),
  monthly_payment DECIMAL(10, 2),
  total_installment_amount DECIMAL(10, 2),
  payment_status VARCHAR(20) CHECK (payment_status IN ('completed', 'in_progress', 'overdue')),
  paid_installments INTEGER DEFAULT 0,
  remaining_installments INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 提醒设置表
CREATE TABLE IF NOT EXISTS domain_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('renewal', 'price', 'expiry')),
  trigger_days_before INTEGER,
  enabled BOOLEAN DEFAULT TRUE,
  last_triggered TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 域名设置表
CREATE TABLE IF NOT EXISTS domain_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  default_currency VARCHAR(3) DEFAULT 'USD',
  default_registrar VARCHAR(100),
  alert_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_domains_owner_user_id ON domains(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
CREATE INDEX IF NOT EXISTS idx_domains_next_renewal_date ON domains(next_renewal_date);
CREATE INDEX IF NOT EXISTS idx_domain_transactions_domain_id ON domain_transactions(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_transactions_type ON domain_transactions(type);
CREATE INDEX IF NOT EXISTS idx_domain_transactions_date ON domain_transactions(date);
CREATE INDEX IF NOT EXISTS idx_domain_alerts_domain_id ON domain_alerts(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_alerts_enabled ON domain_alerts(enabled);

-- 启用行级安全
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_settings ENABLE ROW LEVEL SECURITY;

-- 创建安全策略
CREATE POLICY "Users can view own domains" ON domains
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own domains" ON domains
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own domains" ON domains
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own domains" ON domains
  FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can view own transactions" ON domain_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM domains 
      WHERE domains.id = domain_transactions.domain_id 
      AND domains.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own transactions" ON domain_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM domains 
      WHERE domains.id = domain_transactions.domain_id 
      AND domains.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own transactions" ON domain_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM domains 
      WHERE domains.id = domain_transactions.domain_id 
      AND domains.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own transactions" ON domain_transactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM domains 
      WHERE domains.id = domain_transactions.domain_id 
      AND domains.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own alerts" ON domain_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM domains 
      WHERE domains.id = domain_alerts.domain_id 
      AND domains.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own alerts" ON domain_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM domains 
      WHERE domains.id = domain_alerts.domain_id 
      AND domains.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own settings" ON domain_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own settings" ON domain_settings
  FOR ALL USING (auth.uid() = user_id);
