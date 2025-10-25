import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '../../../src/lib/emailVerification'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, email } = body

    if (!token || !email) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const isValid = await verifyToken(token, email)

    if (!isValid) {
      return NextResponse.json({ error: '验证令牌无效或已过期' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: '邮箱验证成功' })
  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.json({ 
      error: '验证失败',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}