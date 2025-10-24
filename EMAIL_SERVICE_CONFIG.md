# 邮件服务配置指南

## 📧 当前状态

目前系统使用**模拟邮件发送**，验证码会在以下位置显示：

### **开发环境**
- **浏览器控制台**: 按F12查看Console
- **API响应**: 直接返回验证码
- **网络请求**: 查看Network标签

### **生产环境**
- **控制台日志**: Vercel Functions日志
- **API响应**: 返回验证码（仅用于测试）

## 🚀 配置真实邮件服务

### **方案1: Resend (推荐)**

1. **注册Resend账户**: https://resend.com
2. **获取API密钥**: 在Dashboard中创建API Key
3. **配置环境变量**:
   ```bash
   RESEND_API_KEY=your-resend-api-key
   ```

4. **更新邮件服务**:
   ```typescript
   // 在 email-worker/src/index.ts 中配置
   const resend = new Resend(process.env.RESEND_API_KEY);
   ```

### **方案2: SendGrid**

1. **注册SendGrid账户**: https://sendgrid.com
2. **获取API密钥**: 在Settings > API Keys中创建
3. **配置环境变量**:
   ```bash
   SENDGRID_API_KEY=your-sendgrid-api-key
   ```

### **方案3: 阿里云邮件推送**

1. **注册阿里云账户**: https://www.aliyun.com
2. **开通邮件推送服务**
3. **配置SMTP设置**

## 🔧 当前测试方法

### **获取验证码**

1. **注册时**: 查看浏览器控制台
2. **重新发送**: 点击"重新发送"按钮
3. **API测试**: 直接调用 `/api/send-verification`

### **测试命令**
```bash
curl -X POST https://66do.vercel.app/api/send-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

## 📝 注意事项

- **测试环境**: 验证码显示在控制台
- **生产环境**: 需要配置真实邮件服务
- **安全考虑**: 生产环境不应返回验证码
- **用户体验**: 建议配置真实邮件服务

## 🎯 下一步

1. **选择邮件服务提供商**
2. **配置API密钥**
3. **更新邮件发送逻辑**
4. **测试邮件发送功能**
