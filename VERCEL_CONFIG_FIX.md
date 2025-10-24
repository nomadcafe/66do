# Vercel配置修复指南

## 🔧 问题解决

### 错误原因
```
Error: Function Runtimes must have a valid version, for example `now-php@1.0.0`.
```

这个错误是因为 `vercel.json` 中的函数运行时配置格式不正确。

### 解决方案

#### 1. 简化vercel.json配置
对于Next.js项目，Vercel会自动检测和处理API路由，不需要复杂的函数配置。

#### 2. 正确的vercel.json格式
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

#### 3. 环境变量设置
**重要**: 环境变量应该在Vercel Dashboard中设置，而不是在vercel.json中：

1. 进入项目设置 → Environment Variables
2. 添加以下环境变量：
   ```
   NEXT_PUBLIC_APP_NAME = 66Do
   NEXT_PUBLIC_APP_URL = https://66do.com
   NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your-supabase-anon-key
   ```

## 🚀 部署步骤

### 1. 重新部署
1. 在Vercel Dashboard中，点击 "Redeploy"
2. 或者推送新的提交到GitHub

### 2. 检查构建日志
- 确认没有函数运行时错误
- 检查环境变量是否正确加载
- 验证Next.js构建成功

### 3. 测试API路由
部署完成后，测试以下端点：
- `https://your-domain.vercel.app/api/users`
- `https://your-domain.vercel.app/api/domains`
- `https://your-domain.vercel.app/api/transactions`

## 📋 最佳实践

### 1. Vercel配置原则
- 保持vercel.json简洁
- 让Vercel自动检测Next.js配置
- 在Dashboard中管理环境变量

### 2. Next.js API路由
- 使用 `app/api/` 目录结构
- 导出正确的HTTP方法处理函数
- 确保函数返回正确的Response对象

### 3. 环境变量管理
- 使用Vercel Dashboard设置环境变量
- 不要将敏感信息提交到代码仓库
- 为不同环境设置不同的值

## 🔍 故障排除

### 常见问题

#### 1. 构建失败
- 检查vercel.json语法
- 确认所有依赖已安装
- 查看构建日志中的具体错误

#### 2. API路由不工作
- 确认API路由文件位置正确
- 检查函数导出格式
- 验证HTTP方法处理

#### 3. 环境变量问题
- 确认在Dashboard中正确设置
- 检查变量名称拼写
- 验证变量值格式

### 验证清单
- [ ] vercel.json配置正确
- [ ] 环境变量在Dashboard中设置
- [ ] 构建成功完成
- [ ] API路由正常工作
- [ ] 应用功能正常
