# Supabase Edge Function 设置指南

## 问题
当前系统提示 `Edge Function returned a non-2xx status code` 和 `404 Not Found`，这是因为缺少 `send-password-reset` Edge Function。

## 解决方案

### 方法1：使用Supabase CLI部署Edge Function

1. **安装Supabase CLI**（如果还没有安装）：
   ```bash
   npm install -g supabase
   ```

2. **登录Supabase**：
   ```bash
   supabase login
   ```

3. **链接到您的项目**：
   ```bash
   supabase link --project-ref svwviyvkpivbdylilbfu
   ```

4. **部署Edge Function**：
   ```bash
   supabase functions deploy send-password-reset
   ```

### 方法2：在Supabase Dashboard中手动创建

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目
3. 进入 **Edge Functions** 页面
4. 点击 **Create a new function**
5. 函数名称：`send-password-reset`
6. 复制 `supabase/functions/send-password-reset/index.ts` 中的代码
7. 点击 **Deploy function**

### 方法3：临时解决方案

如果暂时无法部署Edge Function，可以修改API代码跳过邮件发送：

```typescript
// 在 app/api/auth/forgot-password/route.ts 中
// 注释掉邮件发送部分，只保存令牌
console.log('Reset URL:', resetUrl)
console.log('请手动访问此链接进行密码重置')
```

## 验证设置

部署Edge Function后，您可以通过以下方式验证：

1. 在Supabase Dashboard的 **Edge Functions** 页面查看函数状态
2. 测试密码重置功能：
   - 访问 `/forgot-password`
   - 输入邮箱
   - 检查控制台日志是否显示成功

## 生产环境邮件配置

在生产环境中，您需要配置实际的邮件发送：

### 选项1：使用Supabase SMTP
在Supabase Dashboard的 **Authentication > Settings** 中配置SMTP设置。

### 选项2：使用第三方邮件服务
集成Resend、SendGrid等服务到Edge Function中。

### 选项3：使用Supabase Auth邮件模板
利用Supabase的内置邮件模板系统。

## 当前状态

- ✅ 密码重置令牌表已创建
- ✅ 重置密码API已实现
- ⚠️ Edge Function需要部署
- ⚠️ 邮件发送需要配置

设置完成后，完整的密码重置流程就可以正常工作了！
