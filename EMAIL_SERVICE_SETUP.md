# 📧 邮件服务配置指南

## 🚀 推荐方案：Resend（简单易用）

### **为什么选择 Resend？**
- ✅ 免费额度：3,000封/月
- ✅ 配置简单，专为开发者设计
- ✅ 与 Cloudflare Workers 完美集成
- ✅ 支持 HTML 和纯文本邮件
- ✅ 无需域名验证即可使用
- ✅ 详细的发送统计和日志

### **配置步骤：**

#### **1. 注册 Resend 账户**
```
访问：https://resend.com
点击 "Get Started"
使用邮箱注册账户
```

#### **2. 获取 API 密钥**
```
登录 Resend Dashboard
进入 "API Keys" 页面
点击 "Create API Key"
复制生成的密钥：re_xxxxxxxxxx
```

#### **3. 在 Cloudflare 中配置密钥**
```
进入 Cloudflare Dashboard
选择你的 Email Worker 项目
进入 "Settings" → "Variables and Secrets"
添加 Secret：
- 名称：RESEND_API_KEY
- 值：re_xxxxxxxxxx（你的API密钥）
```

---

## 🔄 备选方案：SendGrid（更稳定）

### **配置步骤：**

#### **1. 注册 Resend 账户**
```
访问：https://resend.com
点击 "Get Started"
使用邮箱注册
```

#### **2. 获取 API 密钥**
```
登录 Resend Dashboard
进入 "API Keys" 页面
点击 "Create API Key"
复制生成的密钥：re_xxxxxxxxxx
```

#### **3. 在 Cloudflare 中配置**
```
进入 Cloudflare Dashboard
选择你的 Email Worker 项目
进入 "Settings" → "Variables and Secrets"
添加 Secret：
- 名称：RESEND_API_KEY
- 值：re_xxxxxxxxxx
```

---

## 🛠️ 代码配置

### **使用 Resend（推荐）**
```typescript
// 在 email-worker/src/index.ts 中
const resendResponse = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: env.FROM_EMAIL,
    to: [email],
    subject: `${env.APP_NAME} 账户验证码`,
    html: emailData.html
  })
});
```

---

## 📋 部署步骤

### **1. 选择邮件服务**
- **推荐**：Resend（更简单，配置少，免费额度大）
- **备选**：SendGrid（更稳定，需要域名验证）

### **2. 配置 API 密钥**
- 在选择的邮件服务中创建 API 密钥
- 在 Cloudflare Dashboard 中添加为 Secret

### **3. 重新部署 Email Worker**
```bash
cd email-worker
wrangler deploy
```

### **4. 测试邮件发送**
- 注册新用户
- 检查是否收到验证码邮件
- 查看 Cloudflare Workers 日志

---

## 🔍 故障排除

### **常见问题：**

1. **邮件发送失败**
   - 检查 API 密钥是否正确
   - 确认域名已验证
   - 查看 Cloudflare Workers 日志

2. **邮件进入垃圾箱**
   - 配置 SPF、DKIM 记录
   - 使用已验证的发送域名
   - 避免使用敏感词汇

3. **API 限制**
   - Resend：3,000封/月（免费）
   - SendGrid：100封/天（免费）

---

## 💡 最佳实践

1. **使用已验证的域名**：提高送达率
2. **设置合适的发送频率**：避免被标记为垃圾邮件
3. **监控发送统计**：定期检查送达率
4. **备份方案**：准备多个邮件服务提供商

选择 Resend 作为主要服务，配置简单且免费额度大！

