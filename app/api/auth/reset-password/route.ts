import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '../../../../src/lib/supabaseService'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// 密码哈希函数
async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, email, password } = body

    if (!token || !email || !password) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少需要6个字符' }, { status: 400 })
    }

    // 验证重置令牌
    const { data: tokenData, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('email', email)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: '重置令牌无效或已过期' }, { status: 400 })
    }

    // 获取用户信息
    const user = await UserService.getUser(email)
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 更新密码
    const hashedPassword = await hashPassword(password)
    const updatedUser = await UserService.updateUser(user.id, {
      password_hash: hashedPassword,
      updated_at: new Date().toISOString()
    })

    if (!updatedUser) {
      return NextResponse.json({ error: '更新密码失败' }, { status: 500 })
    }

    // 删除已使用的重置令牌
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('token', token)

    return NextResponse.json({ 
      success: true, 
      message: '密码重置成功' 
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ 
      error: '重置密码失败',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
