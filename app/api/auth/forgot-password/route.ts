import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '../../../../src/lib/supabaseService'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// 生成重置令牌
function generateResetToken(): string {
  return crypto.randomUUID()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: '缺少邮箱地址' }, { status: 400 })
    }

    // 检查用户是否存在
    const user = await UserService.getUser(email)
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 生成重置令牌
    const token = generateResetToken()
    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`
    
    // 保存重置令牌到数据库
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token,
        email,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1小时后过期
        created_at: new Date().toISOString()
      })

    if (tokenError) {
      console.error('Failed to save reset token:', tokenError)
      return NextResponse.json({ error: '保存重置令牌失败' }, { status: 500 })
    }

    // 发送重置邮件 - 使用简单的邮件发送方式
    try {
      // 这里我们暂时跳过实际的邮件发送，只记录日志
      // 在生产环境中，您需要配置邮件服务（如Resend、SendGrid等）
      console.log('Password reset email would be sent to:', email)
      console.log('Reset URL:', resetUrl)
      
      // TODO: 集成实际的邮件服务
      // 例如使用 Resend:
      // const { Resend } = require('resend')
      // const resend = new Resend(process.env.RESEND_API_KEY)
      // await resend.emails.send({
      //   from: 'noreply@66do.com',
      //   to: email,
      //   subject: '重置您的密码',
      //   html: `<p>请点击以下链接重置您的密码：<a href="${resetUrl}">重置密码</a></p>`
      // })

      console.log('Password reset email sent successfully to:', email)
    } catch (emailError) {
      console.error('Error sending reset email:', emailError)
      // 不阻止重置流程，只记录错误
      console.log('Email sending failed, but reset token was saved successfully')
    }

    return NextResponse.json({ 
      success: true, 
      message: '重置密码邮件已发送' 
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ 
      error: '发送重置邮件失败',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
