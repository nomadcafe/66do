# D1数据库绑定配置指南

## 🚨 解决500错误的关键步骤

### 1. **Cloudflare Pages控制台配置**

#### **步骤1：进入Pages项目设置**
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Pages** 部分
3. 选择 **66do** 项目
4. 点击 **Settings** 标签

#### **步骤2：配置D1数据库绑定**
1. 在 **Settings** 页面找到 **Functions** 部分
2. 点击 **D1 Database bindings**
3. 点击 **Add binding**
4. 配置如下：
   - **Variable name**: `DB`
   - **D1 Database**: 选择 `66domain-db`
   - 点击 **Save**

#### **步骤3：验证绑定**
1. 在 **Functions** 部分应该看到：
   ```
   D1 Database bindings
   DB → 66domain-db (a0579a97-ef29-4c0a-b146-618d93d0cb2f)
   ```

### 2. **环境变量配置**

#### **在Pages设置中添加环境变量**
1. 进入 **Settings** → **Environment variables**
2. 添加以下变量：
   ```
   NEXT_PUBLIC_APP_NAME = "66Do"
   NEXT_PUBLIC_APP_URL = "https://66do.pages.dev"
   ```

### 3. **验证数据库连接**

#### **测试D1数据库连接**
```bash
# 检查远程数据库
npx wrangler d1 execute 66domain-db --remote --command "SELECT COUNT(*) FROM users;"

# 检查表结构
npx wrangler d1 execute 66domain-db --remote --command "PRAGMA table_info(users);"
```

### 4. **API路由调试**

#### **检查API路由是否正确部署**
1. 访问 `https://66do.pages.dev/api/users`
2. 应该返回CORS错误（这是正常的，因为需要POST请求）

#### **测试API端点**
```bash
# 测试用户创建
curl -X POST https://66do.pages.dev/api/users \
  -H "Content-Type: application/json" \
  -d '{"action":"saveUser","user":{"id":"test","email":"test@example.com","password_hash":"hash","email_verified":false,"created_at":"2024-01-01T00:00:00Z","updated_at":"2024-01-01T00:00:00Z"}}'
```

### 5. **常见问题解决**

#### **问题1：D1数据库绑定未找到**
- **症状**: 500错误，日志显示"Database not available"
- **解决**: 在Cloudflare Pages控制台配置D1绑定

#### **问题2：CORS错误**
- **症状**: 浏览器控制台显示CORS错误
- **解决**: 检查API路由的CORS头设置

#### **问题3：数据库表不存在**
- **症状**: SQL错误，表不存在
- **解决**: 运行数据库迁移脚本

### 6. **部署验证清单**

- [ ] D1数据库绑定已配置
- [ ] 环境变量已设置
- [ ] 数据库表已创建
- [ ] API路由已部署
- [ ] CORS头已配置
- [ ] 错误处理已实现

### 7. **监控和调试**

#### **查看部署日志**
1. 进入Cloudflare Pages项目
2. 点击 **Functions** 标签
3. 查看 **Logs** 部分

#### **实时调试**
```bash
# 查看实时日志
npx wrangler pages tail 66do --format=pretty
```

## 🎯 关键配置点

### **wrangler.toml配置**
```toml
# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "66domain-db"
database_id = "a0579a97-ef29-4c0a-b146-618d93d0cb2f"

# Pages Functions configuration
[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "66domain-db"
database_id = "a0579a97-ef29-4c0a-b146-618d93d0cb2f"
```

### **API路由绑定检查**
```typescript
// 检查D1数据库绑定
if (!DB) {
  console.error('D1 database binding not found');
  return new Response(JSON.stringify({ 
    error: 'Database not available',
    details: 'D1 database binding is not configured'
  }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

## 🚀 完成后的验证

1. **用户注册应该成功**
2. **数据库操作应该正常**
3. **邮箱验证应该工作**
4. **没有500错误**

如果仍有问题，请检查Cloudflare Pages控制台的绑定配置！
