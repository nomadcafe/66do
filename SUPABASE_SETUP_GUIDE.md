# Supabase设置指南

## 🚀 快速开始

### 1. 创建Supabase项目
1. 访问 https://supabase.com
2. 点击 "Start your project"
3. 使用GitHub登录
4. 点击 "New Project"
5. 填写项目信息：
   - **Name**: 66do
   - **Database Password**: 设置强密码
   - **Region**: 选择离您最近的区域
6. 点击 "Create new project"
7. 等待项目创建完成（约2-3分钟）

### 2. 获取连接信息
1. 在项目Dashboard中，点击左侧菜单的 "Settings"
2. 点击 "API"
3. 复制以下信息：
   - **Project URL**: `https://your-project.supabase.co`
   - **anon public**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 3. 设置数据库架构
1. 在Supabase Dashboard中，点击左侧菜单的 "SQL Editor"
2. 点击 "New query"
3. 复制 `database/supabase_schema.sql` 的内容
4. 粘贴到SQL编辑器中
5. 点击 "Run" 执行脚本

### 4. 配置Vercel环境变量
1. 在Vercel Dashboard中，进入项目设置
2. 点击 "Environment Variables"
3. 添加以下变量：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. 测试连接
1. 部署项目到Vercel
2. 访问应用并尝试注册用户
3. 检查Supabase Dashboard中的 "Table Editor" 查看数据

## 🔧 高级配置

### 启用邮箱认证（可选）
1. 在Supabase Dashboard中，点击 "Authentication"
2. 点击 "Settings"
3. 配置邮箱设置：
   - **SMTP Host**: 您的SMTP服务器
   - **SMTP Port**: 587
   - **SMTP User**: 您的邮箱
   - **SMTP Pass**: 您的邮箱密码

### 配置行级安全策略
数据库架构已包含基本的RLS策略，确保用户只能访问自己的数据。

### 备份设置
1. 在Supabase Dashboard中，点击 "Settings"
2. 点击 "Database"
3. 启用 "Point-in-time Recovery"

## 📊 监控和维护

### 查看使用情况
- 在Supabase Dashboard的 "Usage" 页面查看数据库使用情况
- 监控API调用次数和存储使用量

### 备份数据
- 使用Supabase CLI导出数据
- 或通过SQL查询导出特定表的数据

## 🚨 故障排除

### 常见问题

#### 1. 连接失败
- 检查环境变量是否正确设置
- 确认Supabase项目状态正常

#### 2. 权限错误
- 检查RLS策略是否正确配置
- 确认用户认证状态

#### 3. 数据同步问题
- 检查网络连接
- 查看浏览器控制台错误信息

### 获取帮助
- Supabase文档: https://supabase.com/docs
- 社区支持: https://github.com/supabase/supabase/discussions
