import { NextRequest, NextResponse } from 'next/server'
import { VerificationTokenService } from '../../../src/lib/supabaseService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { 
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

    // 验证令牌
    let tokenData = null
    try {
      tokenData = await VerificationTokenService.getToken(token)
    } catch (error) {
      console.log('Warning: Supabase connection failed for token verification:', error)
      // 如果Supabase连接失败，返回错误
      return NextResponse.json({ 
        error: 'Database connection failed. Please try again later.' 
      }, { 
        status: 500,
        headers: corsHeaders
      })
    }
    
    if (!tokenData) {
      return NextResponse.json({ 
        error: 'Invalid or expired token' 
      }, { 
        status: 400,
        headers: corsHeaders
      })
    }

    // 删除已使用的令牌
    try {
      await VerificationTokenService.deleteToken(token)
    } catch (error) {
      console.log('Warning: Failed to delete token:', error)
      // 继续执行，不中断流程
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Token verified successfully',
      user_id: tokenData.user_id
    }, { 
      headers: corsHeaders
    })

  } catch (error) {
    console.error('Verify token error:', error)
    return NextResponse.json({ 
      error: 'Failed to verify token',
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
