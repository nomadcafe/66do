# 66Do 项目部署指南

## 🚀 创建新的Cloudflare Pages项目

### 1. 创建Cloudflare Pages项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** 服务
3. 点击 **创建项目** → **连接到Git**
4. 选择你的GitHub仓库：`handlegpt/yofinance`
5. 项目名称设置为：`66do`
6. 框架预设：**Next.js**
7. 构建命令：`npm run build`
8. 构建输出目录：`dist`

### 2. 创建D1数据库

1. 在Cloudflare Dashboard中进入 **D1 SQL Database**
2. 点击 **创建数据库**
3. 数据库名称：`66do-db`
4. 创建完成后，记录数据库ID

### 3. 配置数据库绑定

1. 在Pages项目设置中，进入 **设置** → **函数**
2. 在 **D1数据库绑定** 部分：
   - 变量名：`DB`
   - 数据库：选择 `66do-db`

### 4. 执行数据库脚本

在D1控制台中执行以下SQL脚本（分步执行）：

#### 步骤1：创建用户表
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 步骤2：创建域名表
```sql
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
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

#### 步骤3：创建交易记录表
```sql
CREATE TABLE IF NOT EXISTS domain_transactions (
  id TEXT PRIMARY KEY,
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

#### 步骤4：创建域名提醒表
```sql
CREATE TABLE IF NOT EXISTS domain_alerts (
  id TEXT PRIMARY KEY,
  domain_id TEXT,
  alert_type TEXT NOT NULL,
  trigger_days_before INTEGER,
  enabled INTEGER DEFAULT 1,
  last_triggered DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 步骤5：创建用户设置表
```sql
CREATE TABLE IF NOT EXISTS domain_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  default_currency TEXT DEFAULT 'USD',
  default_registrar TEXT,
  alert_preferences TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 步骤6：创建索引
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

### 5. 更新wrangler.toml

更新 `wrangler.toml` 文件中的数据库ID：

```toml
# Cloudflare Pages Configuration
name = "66do"
compatibility_date = "2025-10-01"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "66do-db"
database_id = "你的新数据库ID"

# Environment variables
[vars]
NEXT_PUBLIC_APP_NAME = "66Do"
NEXT_PUBLIC_APP_URL = "https://66do.pages.dev"

# Pages configuration
pages_build_output_dir = "dist"
```

### 6. 部署项目

1. 提交所有更改到Git：
```bash
git add .
git commit -m "Rename project to 66Do - Domain Investment Platform"
git push origin main
```

2. Cloudflare Pages会自动检测到更改并开始构建

3. 构建完成后，访问：`https://66do.pages.dev`

## 🔧 本地开发

### 安装依赖
```bash
npm install
```

### 本地运行
```bash
npm run dev
```

### 构建项目
```bash
npm run build
```

## 📝 注意事项

1. **数据库ID**：确保在 `wrangler.toml` 中更新正确的数据库ID
2. **域名**：新项目将使用 `66do.pages.dev` 域名
3. **数据迁移**：如果需要从旧项目迁移数据，需要手动导出/导入
4. **环境变量**：确保所有环境变量都正确配置

## 🎯 下一步

1. 测试所有功能是否正常工作
2. 配置自定义域名（可选）
3. 设置监控和日志
4. 优化性能

---

**项目信息**
- 项目名称：66Do
- 域名：https://66do.pages.dev
- 数据库：66do-db
- 框架：Next.js 14
- 部署平台：Cloudflare Pages
