# D1 兼容的SQL语句

## ❌ **错误原因：D1不支持PostgreSQL语法**

## ✅ **解决方案：使用D1兼容的SQL语句**

### **第一步：创建用户表（D1兼容版本）**
```sql
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **第二步：创建域名表（D1兼容版本）**
```sql
CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    domain_name TEXT UNIQUE NOT NULL,
    registrar TEXT,
    purchase_date TEXT,
    purchase_cost REAL,
    renewal_cost REAL,
    total_renewal_paid REAL DEFAULT 0,
    next_renewal_date TEXT,
    status TEXT DEFAULT 'active',
    estimated_value REAL,
    tags TEXT,
    owner_user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **第三步：创建交易记录表（D1兼容版本）**
```sql
CREATE TABLE IF NOT EXISTS domain_transactions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    domain_id TEXT,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    date TEXT NOT NULL,
    notes TEXT,
    platform TEXT,
    transaction_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    gross_amount REAL,
    fee_percentage REAL,
    fee_amount REAL,
    payment_plan TEXT DEFAULT 'lump_sum',
    installment_period INTEGER,
    installment_fee_percentage REAL,
    installment_fee_amount REAL,
    monthly_payment REAL,
    total_installment_amount REAL,
    payment_status TEXT DEFAULT 'completed',
    paid_installments INTEGER DEFAULT 0,
    remaining_installments INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **第四步：创建域名提醒表（D1兼容版本）**
```sql
CREATE TABLE IF NOT EXISTS domain_alerts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    domain_id TEXT,
    alert_type TEXT NOT NULL,
    trigger_days_before INTEGER,
    enabled INTEGER DEFAULT 1,
    last_triggered DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **第五步：创建用户设置表（D1兼容版本）**
```sql
CREATE TABLE IF NOT EXISTS domain_settings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    user_id TEXT,
    default_currency TEXT DEFAULT 'USD',
    default_registrar TEXT,
    alert_preferences TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **第六步：创建索引**
```sql
CREATE INDEX IF NOT EXISTS idx_domains_owner ON domains(owner_user_id);
```

```sql
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
```

```sql
CREATE INDEX IF NOT EXISTS idx_transactions_domain ON domain_transactions(domain_id);
```

```sql
CREATE INDEX IF NOT EXISTS idx_transactions_date ON domain_transactions(date);
```

### **第七步：验证表创建成功**
```sql
SELECT name FROM sqlite_master WHERE type='table';
```

## 🎯 **主要变化：**

1. **UUID → TEXT** - D1使用TEXT类型存储UUID
2. **VARCHAR → TEXT** - D1使用TEXT类型
3. **DECIMAL → REAL** - D1使用REAL类型存储小数
4. **TIMESTAMP WITH TIME ZONE → DATETIME** - D1使用DATETIME类型
5. **BOOLEAN → INTEGER** - D1使用INTEGER存储布尔值
6. **JSON → TEXT** - D1使用TEXT存储JSON字符串
7. **gen_random_uuid() → 自定义UUID生成函数** - D1不支持gen_random_uuid()

## ✅ **现在使用这些D1兼容的SQL语句！**
