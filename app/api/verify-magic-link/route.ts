import { NextRequest, NextResponse } from 'next/server'
import { VerificationTokenService, UserService } from '../../../src/lib/supabaseService'
import { createSession } from '../../../src/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    console.log('Verify magic link request:', { token: token?.substring(0, 8) + '****' })

    if (!token) {
      console.log('Error: Token is required')
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

    // 验证Magic Link令牌
    let tokenData = null
    try {
      console.log('Attempting to get magic link token from database...')
      tokenData = await VerificationTokenService.getToken(token)
      console.log('Magic link token data retrieved:', tokenData ? 'Found' : 'Not found')
    } catch (error) {
      console.log('Warning: Supabase connection failed for magic link verification:', error)
      // 如果Supabase连接失败，返回错误
      return NextResponse.json({ 
        error: 'Database connection failed. Please try again later.' 
      }, { 
        status: 500,
        headers: corsHeaders
      })
    }
    
    if (!tokenData) {
      console.log('Error: Magic link token not found in database')
      return NextResponse.json({ 
        error: 'Invalid or expired magic link' 
      }, { 
        status: 400,
        headers: corsHeaders
      })
    }

    // 检查令牌是否过期
    const now = new Date()
    const expiresAt = new Date(tokenData.expires_at)
    if (now > expiresAt) {
      console.log('Error: Magic link token has expired')
      return NextResponse.json({ 
        error: 'Magic link has expired' 
      }, { 
        status: 400,
        headers: corsHeaders
      })
    }

    // 删除已使用的令牌
    try {
      await VerificationTokenService.deleteToken(token)
    } catch (error) {
      console.log('Warning: Failed to delete magic link token:', error)
      // 继续执行，不中断流程
    }

    // 创建或获取用户
    const userEmail = tokenData.user_id
    let user = null

    try {
      // 尝试从数据库获取用户
      const existingUser = await UserService.getUser(userEmail)

      if (existingUser) {
        user = existingUser
        console.log('Found existing user:', user.email)
      } else {
        // 创建新用户
        const newUser = {
          id: crypto.randomUUID(),
          email: userEmail,
          password_hash: '', // Magic Link用户不需要密码
          email_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const createdUser = await UserService.createUser(newUser)

        if (createdUser) {
          user = createdUser
          console.log('Created new user:', user.email)
        } else {
          console.log('Failed to create user, using temporary user object')
          // 如果创建失败，使用临时用户对象
          user = newUser
        }
      }
    } catch (error) {
      console.log('Error in user creation/lookup:', error)
      // 如果数据库操作失败，创建临时用户对象
      user = {
        id: crypto.randomUUID(),
        email: userEmail,
        password_hash: '', // Magic Link用户不需要密码
        email_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }

    // 创建会话
    const session = createSession(user)

    return NextResponse.json({ 
      success: true, 
      message: 'Magic link verified successfully',
      user: {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      session_token: session.token,
      expires_at: session.expires_at
    }, { 
      headers: corsHeaders
    })

  } catch (error) {
    console.error('Verify magic link error:', error)
    return NextResponse.json({ 
      error: 'Failed to verify magic link',
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
