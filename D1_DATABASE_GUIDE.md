# Cloudflare D1 数据库使用指南

## 🎯 **D1数据库简介**

Cloudflare D1是基于SQLite的全球分布式数据库，专为Cloudflare Pages设计：

### ✅ **核心特性：**
- **SQLite兼容** - 使用标准SQL语法
- **全球分布** - 数据存储在用户附近
- **零配置** - 无需管理服务器
- **免费额度** - 每月100万次读取免费
- **自动扩展** - 根据使用量自动调整
- **边缘计算** - 在Cloudflare边缘节点运行

## 🚀 **快速开始**

### **1. 创建D1数据库**
```bash
# 在项目目录下执行
wrangler d1 create yofinance-db

# 输出示例：
# ✅ Successfully created DB 'yofinance-db' in region APAC
# Created your database using D1's new storage engine. The new storage engine is not yet recommended for production workloads, but backs up your data via R2.
# [[d1_databases]]
# binding = "DB"
# database_name = "yofinance-db"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### **2. 执行数据库脚本**
```bash
# 执行schema.sql创建表结构
wrangler d1 execute yofinance-db --file=./database/schema.sql

# 或者直接执行SQL命令
wrangler d1 execute yofinance-db --command="CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT);"
```

### **3. 查询数据**
```bash
# 查询所有域名
wrangler d1 execute yofinance-db --command="SELECT * FROM domains;"

# 查询特定用户的数据
wrangler d1 execute yofinance-db --command="SELECT * FROM domains WHERE owner_user_id = '1';"
```

## 📊 **数据库操作示例**

### **插入数据**
```sql
-- 插入新域名
INSERT INTO domains (domain_name, registrar, purchase_date, purchase_cost, status, owner_user_id) 
VALUES ('example.com', 'GoDaddy', '2024-01-01', 12.99, 'active', '1');

-- 插入交易记录
INSERT INTO domain_transactions (domain_id, type, amount, currency, date, notes) 
VALUES ('1', 'buy', 12.99, 'USD', '2024-01-01', 'Initial purchase');
```

### **查询数据**
```sql
-- 获取所有域名及其交易
SELECT d.*, COUNT(dt.id) as transaction_count
FROM domains d
LEFT JOIN domain_transactions dt ON d.id = dt.domain_id
GROUP BY d.id;

-- 获取用户的总投资
SELECT 
  owner_user_id,
  COUNT(*) as domain_count,
  SUM(purchase_cost) as total_investment,
  AVG(purchase_cost) as avg_investment
FROM domains 
WHERE owner_user_id = '1'
GROUP BY owner_user_id;
```

### **更新数据**
```sql
-- 更新域名状态
UPDATE domains 
SET status = 'sold', estimated_value = 500.00 
WHERE id = '1';

-- 更新续费信息
UPDATE domains 
SET renewal_cost = 15.99, next_renewal_date = '2025-01-01' 
WHERE id = '1';
```

### **删除数据**
```sql
-- 删除域名
DELETE FROM domains WHERE id = '1';

-- 删除过期域名
DELETE FROM domains WHERE status = 'expired' AND next_renewal_date < date('now');
```

## 🔧 **在代码中使用D1**

### **API路由示例**
```typescript
// functions/api/domains.ts
export async function onRequest(context: any) {
  const { env } = context;
  
  // 查询所有域名
  const domains = await env.DB.prepare(
    "SELECT * FROM domains ORDER BY created_at DESC"
  ).all();
  
  return new Response(JSON.stringify(domains), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### **复杂查询示例**
```typescript
// 获取用户投资统计
export async function getUserStats(userId: string, env: Env) {
  const stats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total_domains,
      SUM(purchase_cost) as total_investment,
      SUM(CASE WHEN status = 'sold' THEN estimated_value ELSE 0 END) as total_revenue,
      AVG(purchase_cost) as avg_investment
    FROM domains 
    WHERE owner_user_id = ?
  `).bind(userId).first();
  
  return stats;
}
```

## 📈 **性能优化**

### **索引优化**
```sql
-- 为常用查询创建索引
CREATE INDEX idx_domains_owner ON domains(owner_user_id);
CREATE INDEX idx_domains_status ON domains(status);
CREATE INDEX idx_transactions_domain ON domain_transactions(domain_id);
CREATE INDEX idx_transactions_date ON domain_transactions(date);
```

### **查询优化**
```typescript
// 使用参数化查询防止SQL注入
const domains = await env.DB.prepare(
  "SELECT * FROM domains WHERE owner_user_id = ? AND status = ?"
).bind(userId, 'active').all();

// 使用LIMIT限制结果数量
const recentDomains = await env.DB.prepare(
  "SELECT * FROM domains ORDER BY created_at DESC LIMIT ?"
).bind(10).all();
```

## 🔒 **安全最佳实践**

### **1. 参数化查询**
```typescript
// ✅ 正确 - 使用参数化查询
const result = await env.DB.prepare(
  "SELECT * FROM domains WHERE id = ?"
).bind(domainId).first();

// ❌ 错误 - 直接拼接SQL
const result = await env.DB.prepare(
  `SELECT * FROM domains WHERE id = '${domainId}'`
).first();
```

### **2. 输入验证**
```typescript
// 验证输入数据
function validateDomain(domain: any) {
  if (!domain.domain_name || typeof domain.domain_name !== 'string') {
    throw new Error('Invalid domain name');
  }
  if (typeof domain.purchase_cost !== 'number' || domain.purchase_cost < 0) {
    throw new Error('Invalid purchase cost');
  }
  return true;
}
```

### **3. 错误处理**
```typescript
try {
  const result = await env.DB.prepare(
    "INSERT INTO domains (domain_name, purchase_cost) VALUES (?, ?)"
  ).bind(domain.domain_name, domain.purchase_cost).run();
  
  return { success: true, id: result.meta.last_row_id };
} catch (error) {
  console.error('Database error:', error);
  return { success: false, error: 'Database operation failed' };
}
```

## 📊 **监控和调试**

### **查看数据库使用情况**
```bash
# 查看数据库信息
wrangler d1 info yofinance-db

# 查看查询统计
wrangler d1 execute yofinance-db --command="SELECT * FROM sqlite_master;"
```

### **性能监控**
```typescript
// 在代码中添加性能监控
const startTime = Date.now();
const result = await env.DB.prepare(query).all();
const duration = Date.now() - startTime;

console.log(`Query took ${duration}ms`);
```

## 🎯 **最佳实践总结**

1. **使用参数化查询** - 防止SQL注入
2. **创建适当索引** - 提升查询性能
3. **限制查询结果** - 使用LIMIT避免大量数据传输
4. **错误处理** - 优雅处理数据库错误
5. **输入验证** - 验证所有用户输入
6. **监控性能** - 跟踪查询执行时间
7. **备份数据** - 定期备份重要数据

## 🚀 **部署到生产环境**

### **1. 更新wrangler.toml**
```toml
[[d1_databases]]
binding = "DB"
database_name = "yofinance-db"
database_id = "your-actual-database-id"
```

### **2. 部署到Cloudflare Pages**
```bash
# 部署应用
wrangler pages deploy out

# 或使用GitHub Actions自动部署
```

### **3. 验证部署**
```bash
# 测试API端点
curl https://yofinance.pages.dev/api/domains

# 检查数据库连接
wrangler d1 execute yofinance-db --command="SELECT COUNT(*) FROM domains;"
```

你的YoFinance项目现在完全支持Cloudflare D1数据库！🎉
