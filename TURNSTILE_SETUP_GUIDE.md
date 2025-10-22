# Cloudflare Turnstile 验证码配置指南

## 🔐 什么是 Turnstile？

Cloudflare Turnstile 是一个免费的验证码服务，可以替代 Google reCAPTCHA。它支持多种验证方式：
- 点击验证（无感验证）
- 邮件验证码
- 短信验证码
- 生物识别验证

## 🚀 配置步骤

### 1. 创建 Turnstile 站点

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Turnstile** 服务
3. 点击 **添加站点**
4. 填写站点信息：
   - 站点名称：`66Do`
   - 域名：`66do.pages.dev`（或你的自定义域名）
5. 选择验证方式：
   - **Managed**：Cloudflare 自动选择最佳验证方式
   - **Non-interactive**：仅邮件/短信验证码
   - **Invisible**：无感验证

### 2. 获取密钥

创建站点后，你会得到：
- **Site Key**：公开密钥，用于前端
- **Secret Key**：私有密钥，用于后端验证

### 3. 配置环境变量

在 Cloudflare Pages 项目设置中添加环境变量：

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=你的站点密钥
TURNSTILE_SECRET_KEY=你的私有密钥
```

### 4. 验证配置

#### 前端验证
```typescript
// 在登录/注册表单中
<Turnstile
  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
  onVerify={(token) => {
    // 处理验证成功
    console.log('验证成功:', token);
  }}
  onError={(error) => {
    // 处理验证失败
    console.error('验证失败:', error);
  }}
/>
```

#### 后端验证
```typescript
// 在 API 路由中验证 token
const verifyTurnstile = async (token: string) => {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
    }),
  });
  
  const result = await response.json();
  return result.success;
};
```

## 🎯 验证方式详解

### 1. Managed 模式（推荐）
- Cloudflare 自动选择最佳验证方式
- 用户体验最佳
- 支持多种验证方式

### 2. Non-interactive 模式
- 仅使用邮件或短信验证码
- 适合高安全要求场景
- 需要用户输入验证码

### 3. Invisible 模式
- 无感验证，用户无感知
- 适合用户体验要求高的场景
- 基于行为分析

## 📧 邮件验证码配置

### 1. 启用邮件验证
在 Turnstile 站点设置中：
1. 选择 **Non-interactive** 模式
2. 启用 **Email verification**
3. 配置邮件模板

### 2. 自定义邮件模板
```html
<!-- 验证码邮件模板 -->
<h2>66Do 安全验证</h2>
<p>您的验证码是：<strong>{{verification_code}}</strong></p>
<p>验证码有效期为 10 分钟。</p>
<p>如果您没有请求此验证码，请忽略此邮件。</p>
```

## 📱 短信验证码配置

### 1. 启用短信验证
1. 在 Turnstile 设置中启用短信验证
2. 配置短信服务提供商
3. 设置短信模板

### 2. 短信模板示例
```
66Do 安全验证：您的验证码是 {{verification_code}}，有效期 10 分钟。
```

## 🔧 高级配置

### 1. 自定义验证规则
```typescript
// 根据用户行为调整验证策略
const turnstileConfig = {
  siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  theme: 'auto', // light, dark, auto
  size: 'normal', // normal, compact
  callback: (token) => {
    // 验证成功回调
  },
  'error-callback': (error) => {
    // 验证失败回调
  },
  'expired-callback': () => {
    // 验证过期回调
  }
};
```

### 2. 多语言支持
```typescript
// 根据用户语言设置验证界面
const getTurnstileLanguage = (userLanguage: string) => {
  const languageMap = {
    'zh': 'zh-CN',
    'en': 'en-US',
    'ja': 'ja-JP',
    'ko': 'ko-KR'
  };
  return languageMap[userLanguage] || 'en-US';
};
```

## 🛡️ 安全最佳实践

### 1. 密钥管理
- 永远不要在客户端暴露 Secret Key
- 定期轮换密钥
- 使用环境变量存储密钥

### 2. 验证策略
- 实施速率限制
- 记录验证日志
- 监控异常行为

### 3. 用户体验
- 提供清晰的错误信息
- 支持重试机制
- 优化加载时间

## 📊 监控和分析

### 1. 验证统计
在 Cloudflare Dashboard 中查看：
- 验证成功率
- 验证方式分布
- 地理位置分析

### 2. 性能监控
- 验证响应时间
- 错误率统计
- 用户行为分析

## 🚀 部署到生产环境

### 1. 更新环境变量
在 Cloudflare Pages 项目设置中：
1. 进入 **设置** → **环境变量**
2. 添加生产环境的 Turnstile 密钥
3. 确保密钥与域名匹配

### 2. 测试验证流程
1. 测试各种验证方式
2. 验证错误处理
3. 检查用户体验

### 3. 监控部署
1. 检查验证成功率
2. 监控错误日志
3. 优化验证策略

---

**注意事项：**
- Turnstile 完全免费，无使用限制
- 支持全球部署，性能优秀
- 与 Cloudflare 生态系统深度集成
- 提供详细的文档和示例代码
