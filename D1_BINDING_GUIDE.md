# Cloudflare Pages D1数据库绑定指南

## 🎯 **在Cloudflare Pages中绑定D1数据库的详细步骤**

### **第一步：访问Cloudflare Pages项目**

1. **登录Cloudflare Dashboard**
   - 访问 [https://dash.cloudflare.com](https://dash.cloudflare.com)
   - 登录你的账户

2. **进入Pages项目**
   - 点击左侧菜单 "Workers & Pages"
   - 点击 "Pages"
   - 找到你的 `yofinance` 项目
   - 点击项目名称进入项目详情

### **第二步：进入设置页面**

1. **点击 "Settings" 标签**
   - 在项目详情页面顶部
   - 点击 "Settings" 标签

2. **找到 "Functions" 部分**
   - 在左侧菜单中找到 "Functions"
   - 点击进入 Functions 设置

### **第三步：绑定D1数据库**

1. **找到 "D1 Database bindings" 部分**
   - 在 Functions 设置页面中
   - 找到 "D1 Database bindings" 部分

2. **添加新的绑定**
   - 点击 "Add binding" 或 "Create binding"
   - 填写以下信息：
     - **Variable name**: `DB`
     - **Database**: 从下拉菜单中选择你的 `yofinance-db` 数据库
     - **Environment**: 选择 "Production" 或 "All environments"

3. **保存绑定**
   - 点击 "Save" 或 "Create binding"
   - 确认绑定已创建

### **第四步：验证绑定**

1. **检查绑定状态**
   - 在 D1 Database bindings 部分
   - 应该看到：
     - Variable name: `DB`
     - Database: `yofinance-db`
     - Status: Active

2. **重新部署应用**
   - 绑定完成后，需要重新部署应用
   - 点击 "Deployments" 标签
   - 点击 "Retry deployment" 或触发新的部署

### **第五步：测试数据库连接**

1. **访问应用**
   - 打开你的应用URL
   - 测试数据库功能

2. **检查API端点**
   - 访问 `/api/domains` 端点
   - 应该能正常返回数据

## 🔧 **如果找不到Functions设置**

### **方法A：通过项目设置**
1. 进入你的Pages项目
2. 点击 "Settings" 标签
3. 在左侧菜单中找到 "Functions"
4. 点击进入

### **方法B：通过wrangler.toml配置**
如果控制台没有Functions设置，可以通过wrangler.toml配置：

```toml
# 在wrangler.toml中确保有D1绑定
[[d1_databases]]
binding = "DB"
database_name = "yofinance-db"
database_id = "85477325-049d-43e2-9b86-6bb1d9de0846"
```

### **方法C：通过CLI部署**
```bash
# 使用wrangler CLI部署
wrangler pages deploy out
```

## 🎯 **绑定后的效果**

### **在代码中使用数据库**
```typescript
// 在functions/api/domains.ts中
export async function onRequest(context: any) {
  const { env } = context;
  
  // 现在可以通过 env.DB 访问D1数据库
  const domains = await env.DB.prepare(
    "SELECT * FROM domains"
  ).all();
  
  return new Response(JSON.stringify(domains));
}
```

## ✅ **验证绑定成功**

1. **检查部署日志**
   - 在 "Deployments" 标签中
   - 查看最新的部署日志
   - 确认没有数据库连接错误

2. **测试API**
   - 访问 `https://your-domain.pages.dev/api/domains`
   - 应该返回数据库中的数据

## 🚨 **常见问题**

### **问题1：找不到Functions设置**
- 确保你的项目是Pages项目，不是Workers项目
- 尝试刷新页面或重新登录

### **问题2：绑定后仍然报错**
- 检查数据库ID是否正确
- 确认数据库已创建表
- 重新部署应用

### **问题3：API返回404**
- 检查functions目录结构
- 确认wrangler.toml配置正确
- 重新部署应用

## 🎉 **完成！**

绑定成功后，你的应用就可以通过 `env.DB` 访问D1数据库了！
