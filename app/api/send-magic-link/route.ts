import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors'
import { logger, serverLogger } from '../../../src/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const MAX_EMAIL_LENGTH = 254
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 简单内存限流：IP -> [timestamp, ...]，保留最近窗口内的请求
const rateLimitByIp = new Map<string, number[]>()
const rateLimitByEmail = new Map<string, number[]>()
const WINDOW_MS_IP = 15 * 60 * 1000
const MAX_PER_IP = 5
const WINDOW_MS_EMAIL = 60 * 60 * 1000
const MAX_PER_EMAIL = 3

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function isRateLimitedIp(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitByIp.get(ip) || []
  const valid = timestamps.filter(t => now - t < WINDOW_MS_IP)
  if (valid.length >= MAX_PER_IP) return true
  valid.push(now)
  rateLimitByIp.set(ip, valid)
  return false
}

function isRateLimitedEmail(email: string): boolean {
  const key = email.toLowerCase().trim()
  const now = Date.now()
  const timestamps = rateLimitByEmail.get(key) || []
  const valid = timestamps.filter(t => now - t < WINDOW_MS_EMAIL)
  if (valid.length >= MAX_PER_EMAIL) return true
  valid.push(now)
  rateLimitByEmail.set(key, valid)
  return false
}

function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const trimmed = email.trim()
  if (!trimmed || trimmed.length > MAX_EMAIL_LENGTH) return null
  if (!EMAIL_REGEX.test(trimmed)) return null
  return trimmed
}

export async function POST(request: NextRequest) {
  try {
    const corsHeaders = getCorsHeaders(request)

    const ip = getClientIp(request)
    if (isRateLimitedIp(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: corsHeaders }
      );
    }
    const rawEmail = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as { email?: unknown }).email
      : undefined
    const email = validateEmail(rawEmail)
    if (!email) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (isRateLimitedEmail(email)) {
      return NextResponse.json(
        { error: 'Too many magic link requests for this email. Please try again later.' },
        { status: 429, headers: corsHeaders }
      )
    }

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
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.domain.financial'}/auth/magic-link`
    
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
