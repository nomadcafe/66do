import { NextRequest, NextResponse } from 'next/server'
import { VerificationTokenService } from '../../../src/lib/supabaseService'

// 发送密码重置邮件
async function sendPasswordResetEmail(email: string, resetUrl: string) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return NextResponse.json({ 
        error: 'Email service not configured',
        details: 'RESEND_API_KEY missing'
      }, { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      })
    }

    // 生成密码重置邮件内容
    const emailContent = {
      subject: '66Do 密码重置',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>66Do 密码重置</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2563eb; font-size: 28px;">66Do</h1>
                <h2 style="color: #374151; font-size: 20px;">密码重置</h2>
            </div>
            
            <div style="background-color: #f9fafb; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
                <p style="font-size: 16px; margin: 0 0 20px 0;">您好！</p>
                <p style="font-size: 16px; margin: 0 0 20px 0;">您请求重置密码，请点击下面的链接来设置新密码：</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                        重置密码
                    </a>
                </div>
                <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                    此链接有效期为 1 小时。如果您没有请求重置密码，请忽略此邮件。
                </p>
            </div>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; color: #6b7280; font-size: 12px;">
                <p style="margin: 0 0 10px 0;">如果按钮无法点击，请复制以下链接到浏览器：</p>
                <p style="margin: 0; word-break: break-all; color: #2563eb;">${resetUrl}</p>
            </div>
        </body>
        </html>
      `,
      text: `
        66Do 密码重置
            
        您请求重置密码，请点击下面的链接来设置新密码：
        ${resetUrl}
            
        此链接有效期为 1 小时。如果您没有请求重置密码，请忽略此邮件。
      `
    }

    // 调用Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'hello@66do.com',
        to: [email],
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      })
    })

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json()
      console.error('Resend API error:', errorData)
      return NextResponse.json({ 
        error: 'Failed to send password reset email',
        details: errorData.message || 'Email service error'
      }, { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      })
    }

    const resendResult = await resendResponse.json()
    console.log('Password reset email sent successfully via Resend:', resendResult)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Password reset email sent'
    }, { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })

  } catch (error) {
    console.error('Password reset email error:', error)
    return NextResponse.json({ 
      error: 'Failed to send password reset email',
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, type, resetUrl } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 处理密码重置邮件
    if (type === 'password_reset' && resetUrl) {
      return await sendPasswordResetEmail(email, resetUrl)
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

    // 直接使用email作为用户标识符，不查询数据库
    // 避免RLS策略问题和用户不存在的问题
    const userId = email
    console.log('Using email as user identifier:', email)

    // 保存验证令牌到数据库
    const tokenData = {
      id: crypto.randomUUID(), // 生成唯一ID
      user_id: userId, // 使用用户ID或email
      token: verificationCode,
      expires_at: expiresAt
    }

    // 尝试保存到Supabase，如果失败则记录错误但继续执行
    try {
      console.log('Saving token to database:', { 
        id: tokenData.id, 
        user_id: tokenData.user_id, 
        token: tokenData.token.substring(0, 2) + '****',
        expires_at: tokenData.expires_at 
      })
      const savedToken = await VerificationTokenService.createToken(tokenData)
      
      if (!savedToken) {
        console.log('Warning: Failed to save verification token to database')
      } else {
        console.log('Token saved successfully to database')
      }
    } catch (error) {
      console.log('Warning: Supabase connection failed:', error)
      // 继续执行，不中断流程
    }

    // 直接使用Resend API发送邮件
    try {
      const resendApiKey = process.env.RESEND_API_KEY
      
      if (!resendApiKey) {
        console.error('RESEND_API_KEY not configured')
        return NextResponse.json({ 
          error: 'Email service not configured',
          details: 'RESEND_API_KEY missing'
        }, { 
          status: 500,
          headers: corsHeaders
        })
      }

      // 生成邮件内容
      const emailContent = {
        subject: '66Do 账户验证码',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="utf-8">
              <title>66Do 账户验证</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #2563eb; font-size: 28px;">66Do</h1>
                  <h2 style="color: #374151; font-size: 20px;">账户验证码</h2>
              </div>
              
              <div style="background-color: #f9fafb; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
                  <p style="font-size: 16px; margin: 0 0 20px 0;">您好！</p>
                  <p style="font-size: 16px; margin: 0 0 20px 0;">您的验证码是：</p>
                  <div style="text-align: center; margin: 30px 0;">
                      <span style="font-size: 36px; font-weight: bold; color: #2563eb; background-color: #eff6ff; padding: 20px 40px; border-radius: 12px; display: inline-block; border: 2px solid #dbeafe;">
                          ${verificationCode}
                      </span>
                  </div>
                  <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                      验证码有效期为 10 分钟。
                  </p>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; color: #6b7280; font-size: 12px;">
                  <p style="margin: 0 0 10px 0;">如果您没有请求此验证码，请忽略此邮件。</p>
                  <p style="margin: 0;">此邮件由 66Do 系统自动发送，请勿回复。</p>
              </div>
          </body>
          </html>
        `,
        text: `
          66Do 账户验证码
            
          您的验证码是：${verificationCode}
            
          验证码有效期为 10 分钟。
            
          如果您没有请求此验证码，请忽略此邮件。
        `
      }

      // 调用Resend API
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'hello@66do.com',
          to: [email],
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        })
      })

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json()
        console.error('Resend API error:', errorData)
        return NextResponse.json({ 
          error: 'Failed to send verification email',
          details: errorData.message || 'Email service error'
        }, { 
          status: 500,
          headers: corsHeaders
        })
      }

      const resendResult = await resendResponse.json()
      console.log('Email sent successfully via Resend:', resendResult)
      
    } catch (emailError) {
      console.error('Email sending error:', emailError)
      return NextResponse.json({ 
        error: 'Failed to send verification email',
        details: 'Email service error'
      }, { 
        status: 500,
        headers: corsHeaders
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Verification email sent'
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
