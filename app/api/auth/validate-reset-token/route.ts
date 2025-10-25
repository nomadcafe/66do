import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, email } = body

    if (!token || !email) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    // 验证重置令牌
    const { data, error } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('email', email)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '重置令牌无效或已过期' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: '令牌有效' })
  } catch (error) {
    console.error('Token validation error:', error)
    return NextResponse.json({ 
      error: '验证令牌失败',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
