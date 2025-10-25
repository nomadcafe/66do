import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '../../../src/lib/supabaseService'
import crypto from 'crypto'

// 密码哈希函数
async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, email, password, user } = body

    // 设置CORS头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    switch (action) {
      case 'getUser':
        const userData = await UserService.getUser(email)
        return NextResponse.json({ success: true, user: userData }, { headers: corsHeaders })
      
      case 'register':
        // 检查用户是否已存在
        const existingUser = await UserService.getUser(email)
        if (existingUser) {
          return NextResponse.json({ error: '用户已存在' }, { 
            status: 400, 
            headers: corsHeaders 
          })
        }

        // 创建新用户
        const newUser = {
          id: crypto.randomUUID(),
          email,
          password_hash: await hashPassword(password),
          email_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const savedUser = await UserService.createUser(newUser)
        
        // 发送验证邮件
        if (savedUser) {
          try {
            const { sendVerificationEmail } = await import('../../../src/lib/emailVerification')
            await sendVerificationEmail(email, savedUser.id)
          } catch (emailError) {
            console.error('Failed to send verification email:', emailError)
            // 不阻止注册，但记录错误
          }
        }

        return NextResponse.json({ success: true, user: savedUser }, { headers: corsHeaders })
      
      case 'create':
      case 'saveUser':
        const savedUser2 = await UserService.createUser(user)
        return NextResponse.json({ success: true, user: savedUser2 }, { headers: corsHeaders })
      
      case 'updateUser':
        const updatedUser = await UserService.updateUser(user.id, user)
        return NextResponse.json({ success: true, user: updatedUser }, { headers: corsHeaders })
      
      case 'updateUserEmailVerification':
        const verificationResult = await UserService.updateEmailVerification(email, user.email_verified)
        return NextResponse.json({ success: verificationResult }, { headers: corsHeaders })
      
      case 'deleteUser':
        const deleteResult = await UserService.updateUser(user.id, { email_verified: false })
        return NextResponse.json({ success: !!deleteResult }, { headers: corsHeaders })
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { 
          status: 400, 
          headers: corsHeaders 
        })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
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
