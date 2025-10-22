-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建域名表
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name VARCHAR(255) UNIQUE NOT NULL,
    registrar VARCHAR(100),
    purchase_date DATE,
    purchase_cost DECIMAL(10,2),
    renewal_cost DECIMAL(10,2),
    total_renewal_paid DECIMAL(10,2) DEFAULT 0,
    next_renewal_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    estimated_value DECIMAL(10,2),
    tags JSON,
    owner_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建交易记录表
CREATE TABLE IF NOT EXISTS domain_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id),
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    date DATE NOT NULL,
    notes TEXT,
    platform VARCHAR(100),
    transaction_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    gross_amount DECIMAL(10,2),
    fee_percentage DECIMAL(5,2),
    fee_amount DECIMAL(10,2),
    payment_plan VARCHAR(20) DEFAULT 'lump_sum',
    installment_period INTEGER,
    installment_fee_percentage DECIMAL(5,2),
    installment_fee_amount DECIMAL(10,2),
    monthly_payment DECIMAL(10,2),
    total_installment_amount DECIMAL(10,2),
    payment_status VARCHAR(20) DEFAULT 'completed',
    paid_installments INTEGER DEFAULT 0,
    remaining_installments INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建域名提醒表
CREATE TABLE IF NOT EXISTS domain_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id),
    alert_type VARCHAR(20) NOT NULL,
    trigger_days_before INTEGER,
    enabled BOOLEAN DEFAULT true,
    last_triggered TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户设置表
CREATE TABLE IF NOT EXISTS domain_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    default_currency VARCHAR(3) DEFAULT 'USD',
    default_registrar VARCHAR(100),
    alert_preferences JSON,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_domains_owner ON domains(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
CREATE INDEX IF NOT EXISTS idx_transactions_domain ON domain_transactions(domain_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON domain_transactions(date);
