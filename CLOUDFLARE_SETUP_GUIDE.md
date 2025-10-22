# Cloudflare Pages + D1 数据库完整部署指南

## 🎯 **你已经完成的步骤：**
✅ 在 cloudflare.com 创建了D1数据库

## 📋 **接下来需要完成的步骤：**

### **第一步：获取数据库信息**

#### **1. 在Cloudflare Dashboard获取数据库ID**
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击左侧菜单 "Workers & Pages"
3. 点击 "D1 SQL Database"
4. 找到你创建的数据库，点击进入
5. 在 "Settings" 标签页中找到 "Database ID"
6. 复制这个ID（格式类似：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）

#### **2. 获取API Token**
1. 在Cloudflare Dashboard右上角点击你的头像
2. 选择 "My Profile"
3. 点击 "API Tokens" 标签
4. 点击 "Create Token"
5. 选择 "Custom token"
6. 权限设置：
   - **Account**: `Cloudflare D1:Edit`
   - **Zone**: `Zone:Read` (如果需要)
7. 点击 "Continue to summary" → "Create Token"
8. 复制生成的Token（只显示一次，请保存好）

### **第二步：安装Wrangler CLI**

#### **在本地安装Wrangler：**
```bash
# 全局安装（推荐）
npm install -g wrangler

# 验证安装
wrangler --version
```

#### **登录Cloudflare：**
```bash
wrangler login
# 会打开浏览器，登录你的Cloudflare账户
```

### **第三步：配置项目**

#### **1. 更新wrangler.toml文件**
编辑项目根目录的 `wrangler.toml` 文件：

```toml
# Cloudflare Pages Configuration with D1 Database
name = "yofinance"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[env.production]
name = "yofinance"

# D1 Database binding - 替换为你的实际数据库ID
[[d1_databases]]
binding = "DB"
database_name = "yofinance-db"
database_id = "你的实际数据库ID"  # 在这里填入你从Dashboard复制的ID

# KV Storage binding（可选，用于缓存）
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"  # 可选，如果需要KV存储
preview_id = "your-preview-kv-namespace-id"

# Environment variables
[vars]
NEXT_PUBLIC_APP_NAME = "YoFinance"
NEXT_PUBLIC_APP_URL = "https://yofinance.pages.dev"

# Build configuration
[build]
command = "npm run build"
cwd = "."
watch_dir = "src"

# Pages configuration
[pages]
build_output_dir = "out"

# Functions configuration
[functions]
directory = "functions"
```

#### **2. 执行数据库脚本**
```bash
# 在项目目录下执行
cd /Users/tomi/Documents/Program/YoFinance

# 执行数据库脚本创建表结构
wrangler d1 execute yofinance-db --file=./database/schema.sql
```

**如果上面的命令失败，可以手动执行：**

```bash
# 查看数据库列表
wrangler d1 list

# 手动执行SQL命令
wrangler d1 execute yofinance-db --command="CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(255) UNIQUE NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());"
```

### **第四步：部署到Cloudflare Pages**

#### **方式A：通过Cloudflare Pages控制台（推荐）**

1. **访问Cloudflare Pages控制台**
   - 打开 [Cloudflare Dashboard](https://dash.cloudflare.com)
   - 点击左侧菜单 "Workers & Pages"
   - 点击 "Pages"
   - 点击 "Create a project"

2. **连接GitHub仓库**
   - 选择 "Connect to Git"
   - 授权GitHub访问
   - 选择 `handlegpt/yofinance` 仓库
   - 点击 "Begin setup"

3. **配置构建设置**
   ```
   项目名称: yofinance
   生产分支: main
   构建命令: npm run build
   构建输出目录: out
   根目录: /
   ```

4. **设置环境变量**
   在 "Settings" → "Environment variables" 中添加：
   ```
   NEXT_PUBLIC_SUPABASE_URL = 你的Supabase_URL（可选）
   NEXT_PUBLIC_SUPABASE_ANON_KEY = 你的Supabase_Key（可选）
   NEXT_PUBLIC_APP_NAME = YoFinance
   NEXT_PUBLIC_APP_URL = https://yofinance.pages.dev
   ```

5. **绑定D1数据库**
   - 在 "Settings" → "Functions" 中
   - 找到 "D1 Database bindings"
   - 添加绑定：
     - **Variable name**: `DB`
     - **Database**: 选择你创建的 `yofinance-db`

6. **部署**
   - 点击 "Save and Deploy"
   - 等待构建完成
   - 访问生成的URL

#### **方式B：通过Wrangler CLI**

```bash
# 构建项目
npm run build

# 部署到Cloudflare Pages
wrangler pages deploy out

# 或者使用项目脚本
npm run deploy
```

### **第五步：验证部署**

#### **1. 测试API端点**
```bash
# 测试域名API
curl https://yofinance.pages.dev/api/domains

# 测试交易API
curl https://yofinance.pages.dev/api/transactions
```

#### **2. 检查数据库连接**
```bash
# 查询数据库
wrangler d1 execute yofinance-db --command="SELECT COUNT(*) FROM domains;"

# 查看表结构
wrangler d1 execute yofinance-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

#### **3. 插入测试数据**
```bash
# 插入测试域名
wrangler d1 execute yofinance-db --command="INSERT INTO domains (domain_name, registrar, purchase_date, purchase_cost, status, owner_user_id) VALUES ('test.com', 'GoDaddy', '2024-01-01', 12.99, 'active', '1');"

# 查询插入的数据
wrangler d1 execute yofinance-db --command="SELECT * FROM domains;"
```

## 🔧 **常见问题解决**

### **问题1：数据库ID找不到**
```bash
# 查看所有数据库
wrangler d1 list

# 如果数据库不存在，重新创建
wrangler d1 create yofinance-db
```

### **问题2：权限错误**
```bash
# 重新登录
wrangler logout
wrangler login
```

### **问题3：构建失败**
```bash
# 清理缓存重新构建
rm -rf .next out
npm run build
```

### **问题4：API返回404**
- 检查 `functions` 目录结构
- 确保 `wrangler.toml` 中配置了 `[functions]`
- 检查函数文件名是否正确

## 📊 **部署后验证清单**

- [ ] Cloudflare Pages部署成功
- [ ] 网站可以正常访问
- [ ] D1数据库连接正常
- [ ] API端点返回数据
- [ ] 可以插入和查询数据
- [ ] 环境变量配置正确
- [ ] 数据库绑定成功

## 🎯 **下一步操作**

1. **测试应用功能**
   - 访问部署的网站
   - 测试用户注册/登录
   - 测试域名添加功能

2. **监控和优化**
   - 查看Cloudflare Analytics
   - 监控数据库使用情况
   - 优化查询性能

3. **生产环境配置**
   - 设置自定义域名
   - 配置SSL证书
   - 设置备份策略

## 🚀 **完成！**

你的YoFinance应用现在已经完全部署到Cloudflare Pages，并连接了D1数据库！

**访问地址**: `https://yofinance.pages.dev`
**数据库**: Cloudflare D1 (全球分布式)
**CDN**: Cloudflare全球网络
**性能**: 边缘计算优化

🎉 **恭喜！你的应用已经成功部署！**
