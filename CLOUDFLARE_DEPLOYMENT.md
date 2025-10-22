# Cloudflare Pages 部署指南

## 🚀 现代Cloudflare Pages功能

### ✅ **支持的功能：**
- **静态站点生成** (SSG)
- **服务端渲染** (SSR) 
- **边缘计算** (Edge Functions)
- **API路由** (Functions)
- **D1数据库** (SQLite)
- **实时功能** (WebSockets)
- **KV存储** (键值存储)
- **Durable Objects** (状态管理)

## 📋 **部署步骤：**

### 1. **安装Wrangler CLI**
```bash
npm install -g wrangler
# 或
npm install wrangler --save-dev
```

### 2. **登录Cloudflare**
```bash
wrangler login
```

### 3. **创建D1数据库**
```bash
# 创建数据库
wrangler d1 create yofinance-db

# 执行数据库脚本
wrangler d1 execute yofinance-db --file=./database/schema.sql
```

### 4. **配置环境变量**
在Cloudflare Pages控制台设置：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`

### 5. **部署方式**

#### 方式A：通过GitHub自动部署
1. 连接GitHub仓库到Cloudflare Pages
2. 设置构建命令：`npm run build`
3. 设置输出目录：`out`
4. 自动部署

#### 方式B：通过Wrangler CLI
```bash
# 构建项目
npm run build

# 部署到Cloudflare Pages
npm run deploy
```

#### 方式C：通过GitHub Actions
```yaml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: yofinance
          directory: out
```

## 🔧 **高级功能配置：**

### **D1数据库集成**
```typescript
// functions/api/domains.ts
export async function onRequest(context: any) {
  const { env } = context;
  const domains = await env.DB.prepare(
    "SELECT * FROM domains"
  ).all();
  return new Response(JSON.stringify(domains));
}
```

### **KV存储**
```typescript
// 存储用户会话
await env.KV.put(`session:${userId}`, sessionData);

// 获取用户会话
const session = await env.KV.get(`session:${userId}`);
```

### **边缘计算**
```typescript
// 在边缘处理请求
export async function onRequest(context: any) {
  const { request } = context;
  const url = new URL(request.url);
  
  // 边缘计算逻辑
  return new Response('Hello from Edge!');
}
```

## 🌐 **优势：**

- **全球CDN** - 内容分发到全球200+城市
- **边缘计算** - 在用户附近处理请求
- **自动扩展** - 根据流量自动调整
- **零配置** - 开箱即用
- **免费额度** - 每月10万次请求免费
- **实时部署** - Git推送即部署

## 📊 **性能对比：**

| 功能 | 传统VPS | Cloudflare Pages |
|------|---------|------------------|
| 全球访问速度 | 慢 | 极快 |
| 自动扩展 | 需配置 | 自动 |
| 维护成本 | 高 | 低 |
| 部署复杂度 | 高 | 低 |
| 安全性 | 需配置 | 内置 |

## 🎯 **推荐配置：**

1. **开发环境**: 使用 `npm run dev:cloudflare`
2. **生产环境**: 使用GitHub自动部署
3. **数据库**: D1 (SQLite) 或 Supabase
4. **存储**: KV存储用户会话
5. **CDN**: 自动启用全球CDN

你的YoFinance项目现在完全支持现代Cloudflare Pages的所有功能！🚀
