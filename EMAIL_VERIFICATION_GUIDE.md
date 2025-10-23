# 66Do 邮件验证码功能实现指南

## 🎯 邮件验证码功能说明

### **邮件验证码的作用**
- **作用**：账户激活验证
- **时机**：注册后发送验证邮件
- **用户体验**：需要查收邮件并输入验证码
- **目的**：确保邮箱真实有效

## 🚀 实现邮件验证码的步骤

### **方案1：使用 Resend（推荐）**

#### 1. 注册 Resend 账户
- 访问 [resend.com](https://resend.com)
- 免费额度：3,000封/月
- 配置简单，文档完善

#### 2. 获取 API 密钥
```bash
# 在 Resend Dashboard 中创建 API Key
RESEND_API_KEY=re_xxxxxxxxxx
```

#### 3. 在 Cloudflare Pages 中配置
```
环境变量：
RESEND_API_KEY=你的API密钥
EMAIL_FROM=noreply@66do.com
```

#### 4. 创建邮件发送 API
```typescript
// functions/api/send-verification.ts
export async function onRequestPost(context: any) {
  const { request, env } = context;
  
  try {
    const { email, verificationCode } = await request.json();
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@66do.com',
        to: [email],
        subject: '66Do 账户验证码',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">66Do 账户验证</h2>
            <p>您的验证码是：<strong style="font-size: 24px; color: #2563eb;">${verificationCode}</strong></p>
            <p>验证码有效期为 10 分钟。</p>
          </div>
        `
      })
    });
    
    if (response.ok) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('Failed to send email');
    }
    
  } catch (error) {
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

#### 5. 更新注册流程
```typescript
// 注册时发送验证码
const signUp = async (email: string, password: string) => {
  // 1. 生成验证码
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  // 2. 发送邮件
  const emailResponse = await fetch('/api/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, verificationCode })
  });
  
  if (emailResponse.ok) {
    // 3. 存储验证码到临时存储
    localStorage.setItem('66do_verification', JSON.stringify({
      email,
      code: verificationCode,
      timestamp: Date.now()
    }));
    
    return { requiresVerification: true };
  }
};
```

#### 6. 添加验证码输入页面
```typescript
// 创建验证码输入组件
const VerificationCodeInput = ({ email, onVerify }) => {
  const [code, setCode] = useState('');
  
  const handleVerify = async () => {
    const stored = localStorage.getItem('66do_verification');
    const verification = JSON.parse(stored);
    
    if (verification.code === code) {
      // 验证成功，完成注册
      onVerify();
    } else {
      // 验证失败
      alert('验证码错误');
    }
  };
  
  return (
    <div>
      <input 
        type="text" 
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="请输入验证码"
      />
      <button onClick={handleVerify}>验证</button>
    </div>
  );
};
```

## 📧 邮件模板示例

### **验证码邮件**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>66Do 账户验证</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb;">66Do</h1>
        <h2>账户验证码</h2>
    </div>
    
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px;">
        <p>您好！</p>
        <p>您的验证码是：</p>
        <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #2563eb; background-color: #eff6ff; padding: 15px 30px; border-radius: 8px;">
                {{verification_code}}
            </span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
            验证码有效期为 10 分钟。
        </p>
    </div>
</body>
</html>
```

## 🔧 配置步骤总结

### **1. 选择邮件服务**
- **Resend**（推荐）：简单易用，免费额度大
- **SendGrid**：功能强大，企业级
- **Cloudflare Email**：与 Pages 集成好

### **2. 配置环境变量**
```
RESEND_API_KEY=re_xxxxxxxxxx
EMAIL_FROM=noreply@66do.com
```

### **3. 创建 API 端点**
- 发送验证码 API
- 验证码验证 API

### **4. 更新前端流程**
- 注册时发送验证码
- 添加验证码输入页面
- 验证成功后完成注册

## 💡 建议

### **当前系统（推荐）**
- 直接注册成功
- 简单高效
- 无需额外验证步骤

### **如果需要邮件验证**
- 集成 Resend 邮件服务
- 添加验证码输入流程
- 确保邮箱真实性

---

**总结：** 当前系统简单高效。如果你需要邮件验证码功能，我可以帮你完整实现！
