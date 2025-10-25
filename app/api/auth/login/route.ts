import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '../../../../src/lib/supabaseService'
import crypto from 'crypto'

// 密码验证函数
function verifyPassword(password: string, hash: string): boolean {
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex')
  return hashedPassword === hash
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    // 获取用户信息
    const user = await UserService.getUser(email)

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 })
    }

    // 检查邮箱是否已验证
    if (!user.email_verified) {
      return NextResponse.json({ error: '请先验证您的邮箱地址' }, { status: 401 })
    }

    // 验证密码
    if (!verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 })
    }

    // 返回用户信息（不包含密码哈希）
    const { password_hash: _, ...userWithoutPassword } = user

    return NextResponse.json({ 
      success: true, 
      user: userWithoutPassword,
      message: '登录成功'
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ 
      error: '登录失败',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
