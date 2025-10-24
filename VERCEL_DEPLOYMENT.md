# Vercel部署指南

## 🚀 部署步骤

### 1. 访问Vercel
- 打开 https://vercel.com
- 使用GitHub账号登录

### 2. 导入项目
- 点击 "New Project"
- 选择 GitHub 仓库: `handlegpt/66do`
- 点击 "Import"

### 3. 配置设置
- **Framework Preset**: Next.js (自动检测)
- **Root Directory**: `./` (默认)
- **Build Command**: `npm run build` (默认)
- **Output Directory**: `.next` (默认)

### 4. 环境变量配置
在Vercel Dashboard中设置以下环境变量：

#### 必需的环境变量：
```
NEXT_PUBLIC_APP_NAME=66Do
NEXT_PUBLIC_APP_URL=https://66do.com
```

#### 数据库配置（可选）：
```
DATABASE_URL=your_database_url
RESEND_API_KEY=your_resend_api_key
```

### 5. 部署
- 点击 "Deploy" 开始部署
- 等待构建完成

## 📝 注意事项

1. **Cloudflare Pages已禁用**: `wrangler.toml` 已重命名为 `wrangler.toml.backup`
2. **API路由**: Vercel原生支持Next.js API路由
3. **数据库**: 需要配置数据库连接（D1或其他）
4. **域名**: 部署后可在Vercel Dashboard配置自定义域名

## 🔧 故障排除

### 构建失败
- 检查 `package.json` 中的依赖
- 确保所有环境变量已设置

### API路由不工作
- 检查 `app/api/` 目录结构
- 确保API路由文件导出正确的函数

### 数据库连接问题
- 检查数据库URL配置
- 确保数据库服务可访问
