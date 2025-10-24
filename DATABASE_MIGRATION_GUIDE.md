# 数据库迁移指南

## 🎯 推荐方案：Vercel Postgres

### 优势
- ✅ **原生集成**: Vercel官方支持
- ✅ **自动扩展**: 根据使用量调整
- ✅ **全球分布**: 多区域部署
- ✅ **简单迁移**: 从SQLite到PostgreSQL

### 迁移步骤

#### 1. 在Vercel Dashboard创建Postgres数据库
1. 访问项目设置 → Storage
2. 点击 "Create Database" → "Postgres"
3. 选择地区（推荐：Singapore）
4. 记录连接字符串

#### 2. 更新环境变量
```bash
# 在Vercel Dashboard设置
DATABASE_URL=postgresql://username:password@host:port/database
```

#### 3. 安装PostgreSQL客户端
```bash
npm install @vercel/postgres
```

#### 4. 更新API路由
将D1数据库查询替换为PostgreSQL查询

## 🔄 替代方案

### 方案2：Supabase (推荐)
- **免费层**: 500MB存储
- **PostgreSQL**: 完全兼容
- **实时功能**: WebSocket支持
- **管理界面**: 内置管理面板

### 方案3：PlanetScale
- **免费层**: 5GB存储
- **MySQL兼容**: 需要调整SQL语法
- **分支功能**: 类似Git的数据库分支

## 📊 当前数据库结构

### 表结构
```sql
-- 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 域名表
CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  registrar TEXT,
  purchase_date DATE,
  purchase_cost DECIMAL(10,2),
  renewal_cost DECIMAL(10,2),
  renewal_cycle INTEGER DEFAULT 1,
  renewal_count INTEGER DEFAULT 0,
  next_renewal_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'active',
  estimated_value DECIMAL(10,2),
  sale_date DATE,
  sale_price DECIMAL(10,2),
  platform_fee DECIMAL(10,2),
  tags TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 交易表
CREATE TABLE domain_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  type TEXT NOT NULL,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 验证令牌表
CREATE TABLE verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 快速开始

### 选择Vercel Postgres
1. 在Vercel Dashboard创建Postgres数据库
2. 复制连接字符串
3. 在项目设置中添加环境变量
4. 部署项目

### 选择Supabase
1. 访问 https://supabase.com
2. 创建新项目
3. 在SQL编辑器中运行上述表结构
4. 复制连接字符串到Vercel环境变量
