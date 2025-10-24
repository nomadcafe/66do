# 66do.com 域名设置指南

## 🌐 域名配置步骤

### 1. Vercel项目设置

#### 导入项目时
- **Project Name**: `66do` (可以使用原名称，因为会使用自定义域名)
- **Framework**: Next.js
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

#### 环境变量设置
```
NEXT_PUBLIC_APP_NAME = 66Do
NEXT_PUBLIC_APP_URL = https://66do.com
NEXT_PUBLIC_SUPABASE_URL = your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-supabase-anon-key
```

### 2. 添加自定义域名

#### 在Vercel Dashboard中
1. 进入项目设置
2. 点击 "Domains" 标签
3. 点击 "Add Domain"
4. 输入 `66do.com`
5. 点击 "Add"

#### 配置DNS记录
Vercel会显示需要配置的DNS记录：

```
Type: A
Name: @
Value: 76.76.19.61

Type: CNAME  
Name: www
Value: cname.vercel-dns.com
```

### 3. 域名DNS配置

#### 在域名注册商处配置
1. 登录您的域名注册商 (如GoDaddy, Namecheap, Cloudflare等)
2. 进入DNS管理页面
3. 添加以下记录：

```
A记录:
@ → 76.76.19.61

CNAME记录:
www → cname.vercel-dns.com
```

#### 如果使用Cloudflare
1. 将域名添加到Cloudflare
2. 将DNS记录设置为：
```
A记录:
@ → 76.76.19.61 (关闭代理)

CNAME记录:
www → cname.vercel-dns.com (关闭代理)
```

### 4. SSL证书配置

#### 自动SSL
- Vercel会自动为自定义域名配置SSL证书
- 证书会在域名验证后自动生成
- 通常需要几分钟到几小时

#### 验证SSL
- 访问 `https://66do.com` 确认SSL正常工作
- 检查浏览器地址栏的锁图标

### 5. 域名验证

#### 检查DNS传播
1. 使用在线工具检查DNS传播：
   - https://dnschecker.org
   - https://whatsmydns.net

2. 确认所有地区都能解析到Vercel IP

#### 验证域名状态
在Vercel Dashboard中：
- 域名状态应显示为 "Valid"
- SSL证书状态应显示为 "Valid"

### 6. 测试部署

#### 访问应用
1. 访问 `https://66do.com`
2. 确认应用正常加载
3. 测试用户注册和登录功能

#### 检查功能
- [ ] 首页正常显示
- [ ] 用户注册功能
- [ ] 用户登录功能
- [ ] Dashboard功能
- [ ] 数据库连接正常

### 7. 高级配置

#### 重定向设置
在Vercel Dashboard的 "Redirects" 中配置：
```
Source: /home
Destination: /
Status: 301
```

#### 自定义404页面
创建 `app/not-found.tsx` 文件

#### 性能优化
- 启用Vercel Analytics
- 配置CDN缓存
- 优化图片加载

## 🚨 故障排除

### 常见问题

#### 1. 域名无法访问
- 检查DNS记录是否正确
- 等待DNS传播完成 (最多24小时)
- 确认域名已添加到Vercel项目

#### 2. SSL证书问题
- 等待Vercel自动生成证书
- 检查域名DNS记录
- 确认域名指向正确的Vercel IP

#### 3. 重定向问题
- 检查Vercel重定向配置
- 确认Next.js路由配置
- 查看浏览器网络请求

### 监控设置

#### 1. 设置监控
- 在Vercel Dashboard启用 "Monitoring"
- 配置错误通知
- 设置性能监控

#### 2. 日志查看
- 在 "Functions" 页面查看API日志
- 在 "Analytics" 页面查看访问统计
- 在 "Logs" 页面查看错误日志

## 📝 部署检查清单

- [ ] Vercel项目创建成功
- [ ] 环境变量配置正确
- [ ] 域名添加到Vercel项目
- [ ] DNS记录配置正确
- [ ] SSL证书自动生成
- [ ] 应用正常访问
- [ ] 所有功能测试通过
- [ ] 监控和日志配置完成
