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

## 📋 **详细部署步骤：**

### 🖥️ **方式一：本地开发环境部署**

#### **1. 安装Wrangler CLI**
```bash
# 全局安装（推荐）
npm install -g wrangler

# 或项目本地安装
cd /Users/tomi/Documents/Program/YoFinance
npm install wrangler --save-dev
```

#### **2. 登录Cloudflare账户**
```bash
# 在项目目录下执行
wrangler login
# 会打开浏览器，登录你的Cloudflare账户
```

#### **3. 创建D1数据库**
```bash
# 在项目目录下执行
wrangler d1 create yofinance-db

# 执行数据库脚本
wrangler d1 execute yofinance-db --file=./database/schema.sql
```

#### **4. 配置环境变量**
在项目根目录创建 `.env.production` 文件：
```bash
# 编辑环境变量文件
nano .env.production
```

添加以下内容：
```env
NEXT_PUBLIC_SUPABASE_URL=你的Supabase_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase_Key
NEXT_PUBLIC_APP_NAME=YoFinance
NEXT_PUBLIC_APP_URL=https://yofinance.pages.dev
```

#### **5. 本地测试部署**
```bash
# 构建项目
npm run build

# 本地测试Cloudflare Pages
npm run dev:cloudflare
```

#### **6. 部署到Cloudflare Pages**
```bash
# 部署到Cloudflare Pages
npm run deploy
```

---

### 🌐 **方式二：通过Cloudflare Pages控制台部署**

#### **1. 访问Cloudflare Pages控制台**
- 打开 [Cloudflare Dashboard](https://dash.cloudflare.com)
- 点击左侧菜单 "Pages"
- 点击 "Create a project"

#### **2. 连接GitHub仓库**
- 选择 "Connect to Git"
- 授权GitHub访问
- 选择 `handlegpt/yofinance` 仓库
- 点击 "Begin setup"

#### **3. 配置构建设置**
```
项目名称: yofinance
生产分支: main
构建命令: npm run build
构建输出目录: out
根目录: /
```

#### **4. 设置环境变量**
在 "Settings" → "Environment variables" 中添加：
```
NEXT_PUBLIC_SUPABASE_URL = 你的Supabase_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY = 你的Supabase_Key
NEXT_PUBLIC_APP_NAME = YoFinance
NEXT_PUBLIC_APP_URL = https://yofinance.pages.dev
```

#### **5. 部署设置**
- 点击 "Save and Deploy"
- 等待构建完成
- 访问生成的URL（如：`https://yofinance-xxx.pages.dev`）

---

### 🔧 **方式三：通过GitHub Actions自动部署**

#### **1. 在GitHub仓库设置Secrets**
- 进入 `https://github.com/handlegpt/yofinance/settings/secrets/actions`
- 添加以下Secrets：
  - `CLOUDFLARE_API_TOKEN` - 从Cloudflare获取
  - `CLOUDFLARE_ACCOUNT_ID` - 从Cloudflare获取

#### **2. 创建GitHub Actions工作流**
在 `.github/workflows/deploy.yml` 文件中：
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

---

### 📍 **具体安装位置说明：**

#### **本地开发环境：**
```bash
# 在Mac上，全局安装位置：
/usr/local/bin/wrangler

# 项目本地安装位置：
/Users/tomi/Documents/Program/YoFinance/node_modules/.bin/wrangler
```

#### **服务器环境：**
```bash
# 在服务器上安装：
sudo npm install -g wrangler

# 或使用项目本地安装：
cd /path/to/your/project
npm install wrangler --save-dev
```

#### **Docker环境：**
```dockerfile
# 在Dockerfile中添加：
RUN npm install -g wrangler
```

---

### 🎯 **推荐部署方式：**

#### **开发阶段：**
- 使用方式一（本地开发环境）
- 快速测试和调试

#### **生产环境：**
- 使用方式二（Cloudflare Pages控制台）
- 自动部署，无需本地安装

#### **企业级：**
- 使用方式三（GitHub Actions）
- 完整的CI/CD流程

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
