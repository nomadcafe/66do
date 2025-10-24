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
    const tokenData = await VerificationTokenService.getToken(token)
    
    if (!tokenData) {
      return NextResponse.json({ 
        error: 'Invalid or expired token' 
      }, { 
        status: 400,
        headers: corsHeaders
      })
    }

    // 删除已使用的令牌
    await VerificationTokenService.deleteToken(token)

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
