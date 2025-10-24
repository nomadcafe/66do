import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '../../../src/lib/supabaseService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, email, user } = body

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
      
      case 'create':
      case 'saveUser':
        const savedUser = await UserService.createUser(user)
        return NextResponse.json({ success: true, user: savedUser }, { headers: corsHeaders })
      
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
