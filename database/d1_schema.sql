-- 66Do D1 Database Schema (SQLite Compatible)
-- 智能投资管理平台数据库表结构

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 域名表
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  domain_name TEXT UNIQUE NOT NULL,
  registrar TEXT,
  purchase_date TEXT,
  purchase_cost REAL,
  renewal_cost REAL,
  renewal_cycle INTEGER DEFAULT 1,
  renewal_count INTEGER DEFAULT 0, -- 已续费次数
  next_renewal_date TEXT,
  expiry_date TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'for_sale', 'sold', 'expired')),
  estimated_value REAL,
  tags TEXT,
  owner_user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 交易记录表
CREATE TABLE IF NOT EXISTS domain_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  domain_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'renew', 'sell', 'transfer', 'fee')),
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  date TEXT NOT NULL,
  notes TEXT,
  platform TEXT,
  transaction_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  gross_amount REAL,
  fee_percentage REAL,
  fee_amount REAL,
  payment_plan TEXT DEFAULT 'lump_sum' CHECK (payment_plan IN ('lump_sum', 'installment')),
  installment_period INTEGER,
  installment_fee_percentage REAL,
  installment_fee_amount REAL,
  monthly_payment REAL,
  total_installment_amount REAL,
  payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('completed', 'in_progress', 'overdue')),
  paid_installments INTEGER DEFAULT 0,
  remaining_installments INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

-- 提醒设置表
CREATE TABLE IF NOT EXISTS domain_alerts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  domain_id TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('renewal', 'price', 'expiry')),
  trigger_days_before INTEGER,
  enabled BOOLEAN DEFAULT 1,
  last_triggered DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

-- 域名设置表
CREATE TABLE IF NOT EXISTS domain_settings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT UNIQUE NOT NULL,
  default_currency TEXT DEFAULT 'USD',
  default_registrar TEXT,
  alert_preferences TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_domains_owner_user_id ON domains(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
CREATE INDEX IF NOT EXISTS idx_domains_expiry_date ON domains(expiry_date);
CREATE INDEX IF NOT EXISTS idx_transactions_domain_id ON domain_transactions(domain_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON domain_transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON domain_transactions(date);
CREATE INDEX IF NOT EXISTS idx_alerts_domain_id ON domain_alerts(domain_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON domain_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON domain_settings(user_id);
