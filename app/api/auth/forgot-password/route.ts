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

    // 发送重置邮件 - 使用Supabase内置邮件功能
    try {
      // 使用Supabase的Auth邮件发送功能
      const { error: emailError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl
      })

      if (emailError) {
        console.error('Failed to send reset email:', emailError)
        // 不阻止流程，只记录错误
        console.log('Reset token saved, but email sending failed. Reset URL:', resetUrl)
      } else {
        console.log('Password reset email sent successfully to:', email)
      }
    } catch (emailError) {
      console.error('Error sending reset email:', emailError)
      // 不阻止流程，只记录错误
      console.log('Reset token saved, but email sending failed. Reset URL:', resetUrl)
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
