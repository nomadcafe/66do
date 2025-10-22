# Cloudflare D1 控制台操作步骤

## 🎯 **确认：D1控制台确实有 "Execute" 按钮**

### 📋 **详细操作步骤：**

#### **1. 访问D1控制台**
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击左侧菜单 "Workers & Pages"
3. 点击 "D1 SQL Database"
4. 点击你创建的数据库名称
5. 点击 "Console" 标签

#### **2. 在控制台中执行SQL（分段执行）**

**第一步：创建用户表**
```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
- 复制上面的SQL
- 粘贴到D1控制台的SQL编辑器
- 点击 **"Execute"** 按钮
- 查看执行结果

**第二步：创建域名表**
```sql
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
```
- 复制上面的SQL
- 粘贴到D1控制台
- 点击 **"Execute"** 按钮

**第三步：创建交易记录表**
```sql
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
```
- 复制上面的SQL
- 粘贴到D1控制台
- 点击 **"Execute"** 按钮

**第四步：创建提醒表**
```sql
CREATE TABLE IF NOT EXISTS domain_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id),
    alert_type VARCHAR(20) NOT NULL,
    trigger_days_before INTEGER,
    enabled BOOLEAN DEFAULT true,
    last_triggered TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
- 复制上面的SQL
- 粘贴到D1控制台
- 点击 **"Execute"** 按钮

**第五步：创建设置表**
```sql
CREATE TABLE IF NOT EXISTS domain_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    default_currency VARCHAR(3) DEFAULT 'USD',
    default_registrar VARCHAR(100),
    alert_preferences JSON,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
- 复制上面的SQL
- 粘贴到D1控制台
- 点击 **"Execute"** 按钮

**第六步：创建索引**
```sql
CREATE INDEX IF NOT EXISTS idx_domains_owner ON domains(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
CREATE INDEX IF NOT EXISTS idx_transactions_domain ON domain_transactions(domain_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON domain_transactions(date);
```
- 复制上面的SQL
- 粘贴到D1控制台
- 点击 **"Execute"** 按钮

#### **3. 验证表创建成功**
```sql
SELECT name FROM sqlite_master WHERE type='table';
```
- 复制上面的SQL
- 粘贴到D1控制台
- 点击 **"Execute"** 按钮
- 应该看到：users, domains, domain_transactions, domain_alerts, domain_settings

#### **4. 插入测试数据（可选）**
```sql
-- 插入测试用户
INSERT INTO users (email) VALUES ('test@example.com');

-- 插入测试域名
INSERT INTO domains (domain_name, registrar, purchase_date, purchase_cost, owner_user_id) 
VALUES ('test.com', 'GoDaddy', '2024-01-01', 12.99, (SELECT id FROM users WHERE email = 'test@example.com'));

-- 插入测试交易
INSERT INTO domain_transactions (domain_id, type, amount, currency, date, notes) 
VALUES ((SELECT id FROM domains WHERE domain_name = 'test.com'), 'buy', 12.99, 'USD', '2024-01-01', 'Initial purchase');
```

## ✅ **确认操作步骤：**

1. **D1控制台确实有 "Execute" 按钮**
2. **可以分段执行SQL脚本**
3. **每次执行后都会显示结果**
4. **支持查看表结构和数据**

## 🎯 **操作要点：**

- ✅ 使用 **"Execute"** 按钮，不是 "Run"
- ✅ 可以分段执行，不需要一次性执行所有SQL
- ✅ 每次执行后查看结果确认成功
- ✅ 最后用查询语句验证表创建成功

**现在你可以在D1控制台直接执行这些SQL脚本了！** 🚀
