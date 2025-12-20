import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors'
import { logger, serverLogger } from '../../../src/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 设置安全的CORS头
    const corsHeaders = getCorsHeaders(request)

    // 检查环境变量
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      serverLogger.error('Missing Supabase environment variables')
      return NextResponse.json({ 
        error: 'Server configuration error',
        details: 'Missing Supabase environment variables'
      }, { 
        status: 500,
        headers: corsHeaders
      })
    }

    // 使用Supabase原生Magic Link
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.66do.com'}/auth/magic-link`
    
    logger.log('Sending magic link to:', email)
    logger.log('Redirect URL:', redirectUrl)
    logger.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: true
      }
    })

    if (error) {
      serverLogger.error('Supabase magic link error:', error)
      serverLogger.error('Error details:', {
        message: error.message,
        status: error.status,
        name: error.name
      })
      
      // 在生产环境中不泄露详细错误信息
      const isProduction = process.env.NODE_ENV === 'production'
      return NextResponse.json({ 
        error: 'Failed to send magic link',
        ...(isProduction ? {} : { 
          details: error.message,
          errorCode: error.status,
          errorName: error.name
        })
      }, { 
        status: 500,
        headers: corsHeaders
      })
    }

    logger.log('Magic link sent successfully:', data)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Magic link email sent'
    }, { 
      headers: corsHeaders
    })

  } catch (error) {
    serverLogger.error('Send magic link error:', error)
    // 在生产环境中不泄露详细错误信息
    const isProduction = process.env.NODE_ENV === 'production'
    return NextResponse.json({ 
      error: 'Failed to send magic link email',
      ...(isProduction ? {} : { details: error instanceof Error ? error.message : 'Unknown error' })
    }, {
      status: 500,
      headers: getCorsHeadersForError()
    })
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request)
  })
}
