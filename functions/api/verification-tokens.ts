import { NextRequest, NextResponse } from 'next/server';

interface VerificationToken {
  id: string;
  user_id: string;
  email: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export async function POST(request: NextRequest) {
  try {
    const { action, userId, email, token, verificationCode } = await request.json();

    if (!userId && !email) {
      return NextResponse.json({ error: 'User ID or email is required' }, { status: 400 });
    }

    switch (action) {
      case 'createToken':
        if (!email || !token) {
          return NextResponse.json({ error: 'Email and token are required' }, { status: 400 });
        }
        return await createToken(email, token);
      
      case 'verifyToken':
        if (!email || !verificationCode) {
          return NextResponse.json({ error: 'Email and verification code are required' }, { status: 400 });
        }
        return await verifyToken(email, verificationCode);
      
      case 'cleanupExpired':
        return await cleanupExpiredTokens();
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Verification token API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function createToken(email: string, token: string) {
  try {
    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10分钟过期
    
    // 先清理该邮箱的旧令牌
    await (globalThis as any).env.DB.prepare(
      'DELETE FROM verification_tokens WHERE email = ?'
    ).bind(email).run();
    
    // 创建新令牌
    const result = await (globalThis as any).env.DB.prepare(`
      INSERT INTO verification_tokens (
        id, user_id, email, token, expires_at, used, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, null, email, token, expiresAt.toISOString(), false, now.toISOString()
    ).run();

    return NextResponse.json({ 
      success: true, 
      token: {
        id,
        email,
        token,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating verification token:', error);
    return NextResponse.json({ error: 'Failed to create verification token' }, { status: 500 });
  }
}

async function verifyToken(email: string, verificationCode: string) {
  try {
    const now = new Date();
    
    // 查找有效的令牌
    const result = await (globalThis as any).env.DB.prepare(`
      SELECT * FROM verification_tokens 
      WHERE email = ? AND token = ? AND used = false AND expires_at > ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(email, verificationCode, now.toISOString()).first();

    if (!result) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or expired verification code' 
      }, { status: 400 });
    }

    // 标记令牌为已使用
    await (globalThis as any).env.DB.prepare(
      'UPDATE verification_tokens SET used = true WHERE id = ?'
    ).bind(result.id).run();

    return NextResponse.json({ 
      success: true, 
      message: 'Verification successful' 
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    return NextResponse.json({ error: 'Failed to verify token' }, { status: 500 });
  }
}

async function cleanupExpiredTokens() {
  try {
    const now = new Date();
    
    const result = await (globalThis as any).env.DB.prepare(
      'DELETE FROM verification_tokens WHERE expires_at < ? OR used = true'
    ).bind(now.toISOString()).run();

    return NextResponse.json({ 
      success: true, 
      deletedCount: result.changes 
    });
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return NextResponse.json({ error: 'Failed to cleanup expired tokens' }, { status: 500 });
  }
}
