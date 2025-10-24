// 邮箱验证功能
import { auditLogger } from './security';

// interface VerificationToken {
//   token: string;
//   email: string;
//   expires_at: string;
//   created_at: string;
// }

// 生成验证令牌
function generateVerificationToken(): string {
  // 生成6位数字验证码
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送验证邮件
export async function sendVerificationEmail(email: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const token = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24小时过期

    // 验证令牌将通过API保存到数据库，这里不需要localStorage

    // 调用邮件服务发送验证邮件
    const response = await fetch('/api/send-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        verificationCode: token,
        userId,
        type: 'email_verification'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send verification email');
    }

    // 记录审计日志
    auditLogger.log(userId, 'verification_email_sent', 'auth', { email });

    return { success: true };
  } catch (error) {
    console.error('Send verification email error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send verification email' 
    };
  }
}

// 验证邮箱令牌
export async function verifyEmailToken(token: string, email: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 调用API验证令牌
    const response = await fetch('/api/verify-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Token verification failed' };
    }

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error || 'Invalid token' };
    }

    // 更新用户邮箱验证状态 - 调用D1数据库API
    const updateResponse = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'updateUserEmailVerification',
        email: email,
        user: { email_verified: true }
      })
    });

    if (!updateResponse.ok) {
      throw new Error('Failed to update email verification status');
    }

    // 记录审计日志
    auditLogger.log('unknown', 'email_verified', 'auth', { email });

    return { success: true };
  } catch (error) {
    console.error('Verify email token error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to verify email' 
    };
  }
}

// 检查邮箱是否已验证
export async function isEmailVerified(email: string): Promise<boolean> {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getUser',
        email: email
      })
    });

    if (!response.ok) {
      throw new Error('Failed to check email verification status');
    }

    const result = await response.json();
    return result.user?.email_verified || false;
  } catch (error) {
    console.error('Check email verification error:', error);
    return false;
  }
}

// 重新发送验证邮件
export async function resendVerificationEmail(email: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 检查是否已经验证
    if (await isEmailVerified(email)) {
      return { success: false, error: 'Email is already verified' };
    }

    // 发送新的验证邮件
    return await sendVerificationEmail(email, userId);
  } catch (error) {
    console.error('Resend verification email error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to resend verification email' 
    };
  }
}
