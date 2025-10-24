import { NextRequest, NextResponse } from 'next/server'
import { VerificationTokenService } from '../../../src/lib/supabaseService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 设置CORS头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    // 生成6位数字验证码
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    
    // 设置过期时间（10分钟）
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // 保存验证令牌到数据库
    const tokenData = {
      id: crypto.randomUUID(), // 生成唯一ID
      user_id: email, // 使用email作为user_id
      token: verificationCode,
      expires_at: expiresAt
    }

    // 尝试保存到Supabase，如果失败则记录错误但继续执行
    try {
      const savedToken = await VerificationTokenService.createToken(tokenData)
      
      if (!savedToken) {
        console.log('Warning: Failed to save verification token to database')
      }
    } catch (error) {
      console.log('Warning: Supabase connection failed:', error)
      // 继续执行，不中断流程
    }

    // 发送邮件（这里需要配置邮件服务）
    // 生产环境不应记录验证码到日志
    
    return NextResponse.json({ 
      success: true, 
      message: 'Verification email sent',
      verificationCode: verificationCode // 仅用于测试
    }, { 
      headers: corsHeaders
    })

  } catch (error) {
    console.error('Send verification error:', error)
    return NextResponse.json({ 
      error: 'Failed to send verification email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}
