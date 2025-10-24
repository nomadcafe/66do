# Vercel环境变量设置指南

## 🔧 正确的环境变量配置

### 1. 在Vercel Dashboard中设置环境变量

#### 进入项目设置
1. 在Vercel Dashboard中，选择您的项目
2. 点击 "Settings" 标签
3. 点击 "Environment Variables"

#### 添加环境变量
点击 "Add New" 按钮，逐个添加以下变量：

```
Name: NEXT_PUBLIC_APP_NAME
Value: 66Do
Environment: Production, Preview, Development

Name: NEXT_PUBLIC_APP_URL  
Value: https://66do.com
Environment: Production, Preview, Development

Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://your-project.supabase.co
Environment: Production, Preview, Development

Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Environment: Production, Preview, Development
```

### 2. 不要使用vercel.json中的环境变量

#### 错误的方式 ❌
```json
{
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@next_public_supabase_url"
  }
}
```

#### 正确的方式 ✅
- 在Vercel Dashboard的 "Environment Variables" 页面直接设置
- 不要使用 `@` 符号引用不存在的密钥

### 3. Supabase环境变量获取

#### 获取Supabase连接信息
1. 访问 https://supabase.com
2. 登录您的项目
3. 点击左侧菜单 "Settings" → "API"
4. 复制以下信息：
   - **Project URL**: `https://your-project.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 4. 环境变量验证

#### 检查设置
在Vercel Dashboard中确认：
- [ ] 所有环境变量都已添加
- [ ] 环境变量值正确
- [ ] 选择了正确的环境 (Production, Preview, Development)

#### 测试部署
1. 重新部署项目
2. 检查构建日志
3. 确认没有环境变量错误

### 5. 常见问题解决

#### 问题1: "references Secret which does not exist"
**原因**: 在vercel.json中引用了不存在的密钥
**解决**: 删除vercel.json中的环境变量引用，在Dashboard中直接设置

#### 问题2: 环境变量不生效
**原因**: 环境变量名称或值不正确
**解决**: 检查变量名称拼写，确认值正确

#### 问题3: 构建失败
**原因**: 缺少必需的环境变量
**解决**: 确保所有必需的环境变量都已设置

### 6. 最佳实践

#### 环境变量管理
- 使用Vercel Dashboard管理环境变量
- 不要将敏感信息提交到代码仓库
- 为不同环境设置不同的值

#### 安全考虑
- Supabase anon key是公开的，可以安全使用
- 不要暴露数据库密码
- 使用环境变量而不是硬编码

### 7. 部署后验证

#### 检查环境变量
1. 在Vercel Dashboard的 "Functions" 页面
2. 查看函数日志
3. 确认环境变量正确加载

#### 测试应用功能
1. 访问应用首页
2. 测试用户注册
3. 检查数据库连接
4. 验证所有功能正常
