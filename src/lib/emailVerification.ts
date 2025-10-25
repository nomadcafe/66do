import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// 生成验证令牌
export function generateVerificationToken(): string {
  return crypto.randomUUID()
}

// 发送验证邮件
export async function sendVerificationEmail(email: string, userId: string): Promise<void> {
  try {
    const token = generateVerificationToken()
    const verificationUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/verify?token=${token}&email=${encodeURIComponent(email)}`
    
    // 保存验证令牌到数据库
    const { error: tokenError } = await supabase
      .from('verification_tokens')
      .insert({
        user_id: userId,
        token,
        email,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小时后过期
        created_at: new Date().toISOString()
      })

    if (tokenError) {
      console.error('Failed to save verification token:', tokenError)
      throw new Error('Failed to save verification token')
    }

    // 发送邮件
    const { error: emailError } = await supabase.functions.invoke('send-verification', {
      body: {
        email,
        verificationUrl,
        subject: '请验证您的邮箱地址',
        template: 'verification'
      }
    })

    if (emailError) {
      console.error('Failed to send verification email:', emailError)
      throw new Error('Failed to send verification email')
    }

    console.log('Verification email sent successfully to:', email)
  } catch (error) {
    console.error('Error sending verification email:', error)
    throw error
  }
}

// 验证令牌
export async function verifyToken(token: string, email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('verification_tokens')
      .select('*')
      .eq('token', token)
      .eq('email', email)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) {
      console.error('Invalid or expired token:', error)
      return false
    }

    // 更新用户验证状态
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', data.user_id)

    if (updateError) {
      console.error('Failed to update user verification status:', updateError)
      return false
    }

    // 删除已使用的令牌
    await supabase
      .from('verification_tokens')
      .delete()
      .eq('token', token)

    return true
  } catch (error) {
    console.error('Error verifying token:', error)
    return false
  }
}