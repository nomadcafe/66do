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

    // 生成Magic Link令牌
    const magicToken = crypto.randomUUID()
    
    // 设置过期时间（15分钟）
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // 保存Magic Link令牌到数据库
    const tokenData = {
      id: crypto.randomUUID(),
      user_id: email, // 使用email作为用户标识符
      token: magicToken,
      expires_at: expiresAt
    }

    // 尝试保存到Supabase
    try {
      console.log('Saving magic link token to database:', { 
        id: tokenData.id, 
        user_id: tokenData.user_id, 
        token: tokenData.token.substring(0, 8) + '****',
        expires_at: tokenData.expires_at 
      })
      const savedToken = await VerificationTokenService.createToken(tokenData)
      
      if (!savedToken) {
        console.log('Warning: Failed to save magic link token to database')
      } else {
        console.log('Magic link token saved successfully to database')
      }
    } catch (error) {
      console.log('Warning: Supabase connection failed:', error)
      // 继续执行，不中断流程
    }

    // 生成Magic Link URL
    const magicLinkUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/magic-link?token=${magicToken}`

    // 使用Resend API发送Magic Link邮件
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
        subject: '66Do 登录链接',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="utf-8">
              <title>66Do 登录链接</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #2563eb; font-size: 28px;">66Do</h1>
                  <h2 style="color: #374151; font-size: 20px;">登录链接</h2>
              </div>
              
              <div style="background-color: #f9fafb; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
                  <p style="font-size: 16px; margin: 0 0 20px 0;">您好！</p>
                  <p style="font-size: 16px; margin: 0 0 20px 0;">点击下面的按钮即可登录到您的账户：</p>
                  <div style="text-align: center; margin: 30px 0;">
                      <a href="${magicLinkUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                          立即登录
                      </a>
                  </div>
                  <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                      此链接有效期为 15 分钟。
                  </p>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; color: #6b7280; font-size: 12px;">
                  <p style="margin: 0 0 10px 0;">如果您没有请求此登录链接，请忽略此邮件。</p>
                  <p style="margin: 0;">此邮件由 66Do 系统自动发送，请勿回复。</p>
              </div>
          </body>
          </html>
        `,
        text: `
          66Do 登录链接
            
          点击下面的链接登录到您的账户：
          ${magicLinkUrl}
            
          此链接有效期为 15 分钟。
            
          如果您没有请求此登录链接，请忽略此邮件。
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
          error: 'Failed to send magic link email',
          details: errorData.message || 'Email service error'
        }, { 
          status: 500,
          headers: corsHeaders
        })
      }

      const resendResult = await resendResponse.json()
      console.log('Magic link email sent successfully via Resend:', resendResult)
      
    } catch (emailError) {
      console.error('Email sending error:', emailError)
      return NextResponse.json({ 
        error: 'Failed to send magic link email',
        details: 'Email service error'
      }, { 
        status: 500,
        headers: corsHeaders
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Magic link email sent'
    }, { 
      headers: corsHeaders
    })

  } catch (error) {
    console.error('Send magic link error:', error)
    return NextResponse.json({ 
      error: 'Failed to send magic link email',
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
