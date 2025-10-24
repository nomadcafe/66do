# Supabase认证故障排除指南

## 🚨 当前问题分析

从错误日志来看，主要有以下问题：

### 1. 500错误 - Supabase服务器错误
```
svwviyvkpivbdylilbfu.supabase.co/auth/v1/otp?redirect_to=https%3A%2F%2Fwww.66do.com%2Fauth%2Fmagic-link:1
Failed to load resource: the server responded with a status of 500 ()
```

### 2. 邮件发送失败
```
Magic link error: AuthApiError: Error sending confirmation email
```

## 🔧 解决方案

### 步骤1: 检查Supabase项目状态

1. **访问Supabase Dashboard**
   - 登录 https://supabase.com
   - 检查项目状态是否正常
   - 确认项目没有暂停或限制

2. **检查项目URL和密钥**
   - 在项目设置中确认URL和密钥正确
   - 确保使用的是正确的项目

### 步骤2: 配置Supabase认证设置

#### 2.1 启用邮箱认证
1. 在Supabase Dashboard中，点击 "Authentication"
2. 点击 "Settings" 标签
3. 在 "Auth Providers" 部分：
   - 确保 "Email" 已启用
   - 检查 "Enable email confirmations" 已开启

#### 2.2 配置重定向URL
1. 在 "Authentication" → "Settings" 中
2. 找到 "Site URL" 设置：
   ```
   https://www.66do.com
   ```
3. 在 "Redirect URLs" 中添加：
   ```
   https://www.66do.com/auth/magic-link
   https://66do.com/auth/magic-link
   ```

#### 2.3 配置SMTP设置（重要）
1. 在 "Authentication" → "Settings" 中
2. 找到 "SMTP Settings" 部分
3. 配置以下设置：

**选项A: 使用Supabase默认SMTP（推荐用于测试）**
- 保持默认设置，Supabase会使用内置SMTP服务

**选项B: 使用自定义SMTP（推荐用于生产）**
```
SMTP Host: smtp.gmail.com (或其他SMTP服务)
SMTP Port: 587
SMTP User: your-email@gmail.com
SMTP Pass: your-app-password
SMTP Admin Email: your-email@gmail.com
```

### 步骤3: 检查环境变量

#### 3.1 验证Vercel环境变量
在Vercel Dashboard中确认以下变量：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://svwviyvkpivbdylilbfu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon密钥
```

#### 3.2 检查环境变量格式
确保：
- URL没有尾部斜杠
- 密钥完整且正确
- 没有多余的空格或字符

### 步骤4: 测试Supabase连接

#### 4.1 创建测试脚本
创建 `test-supabase.js` 文件：

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key:', supabaseKey ? 'Set' : 'Not set')

const supabase = createClient(supabaseUrl, supabaseKey)

// 测试连接
async function testConnection() {
  try {
    const { data, error } = await supabase.auth.getSession()
    console.log('Connection test:', error ? 'Failed' : 'Success')
    if (error) console.error('Error:', error)
  } catch (err) {
    console.error('Connection error:', err)
  }
}

testConnection()
```

#### 4.2 运行测试
```bash
node test-supabase.js
```

### 步骤5: 修复认证流程

#### 5.1 更新SupabaseAuthContext
确保重定向URL正确：

```typescript
const signInWithMagicLink = async (email: string) => {
  setLoading(true);
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/magic-link`,
      }
    });

    if (error) {
      console.error('Magic link error:', error);
      return { error };
    }

    return { error: null };
  } catch (error) {
    console.error('Magic link error:', error);
    return { error: error as AuthError };
  } finally {
    setLoading(false);
  }
};
```

#### 5.2 更新魔法链接处理
确保正确处理Supabase的响应：

```typescript
// 在魔法链接页面中
const { data, error } = await supabase.auth.verifyOtp({
  token_hash: token,
  type: 'magiclink'
});
```

### 步骤6: 检查Supabase项目限制

#### 6.1 检查使用限制
1. 在Supabase Dashboard中查看 "Usage" 页面
2. 确认没有超出免费额度
3. 检查是否有API调用限制

#### 6.2 检查项目状态
1. 确认项目没有暂停
2. 检查数据库连接状态
3. 验证认证服务状态

## 🚀 快速修复步骤

### 立即执行：

1. **检查Supabase Dashboard**
   - 确认项目状态正常
   - 检查认证设置

2. **更新重定向URL**
   - 在Supabase Dashboard中添加正确的重定向URL

3. **重新部署**
   - 在Vercel中重新部署项目
   - 确保环境变量正确

4. **测试认证流程**
   - 尝试发送魔法链接
   - 检查是否收到邮件

## 📞 如果问题持续存在

1. **检查Supabase状态页面**
   - 访问 https://status.supabase.com
   - 确认服务正常

2. **联系Supabase支持**
   - 如果问题持续，联系Supabase技术支持

3. **回滚到旧系统**
   - 如果急需修复，可以临时回滚到localStorage认证

## 🔍 调试信息

### 有用的调试代码：
```javascript
// 在浏览器控制台中运行
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not set')

// 测试Supabase连接
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
supabase.auth.getSession().then(console.log)
```
