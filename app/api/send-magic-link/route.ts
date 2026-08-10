import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors'
import { logger, serverLogger } from '../../../src/lib/logger'
import { checkMagicLinkRateLimit } from '../../../src/lib/rateLimit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const MAX_EMAIL_LENGTH = 254
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Vercel rewrites x-forwarded-for at the edge, making it the real client IP.
// Other environments (Docker compose, bare Node behind no proxy, etc.) leave
// the header attacker-controlled — trusting it there lets the magic-link
// rate limit be bypassed by spoofing a fresh IP per request. The VERCEL env
// var is auto-injected on Vercel and absent elsewhere, so it's the cleanest
// signal that "x-forwarded-for is trustworthy here".
function getClientIp(request: NextRequest): string {
  const onVercel = process.env.VERCEL === '1'
  if (onVercel) {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    )
  }
  // Off-Vercel: fall back to an empty token so all requests share a single
  // rate-limit bucket. That's strictly *more* aggressive than per-IP and
  // closes the spoof window — at the cost of a self-hosted operator
  // sharing the bucket across legitimate users. The expected deploy target
  // is Vercel, so this path is mostly for local dev safety.
  return 'unknown'
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

    const ip = getClientIp(request)
    const rl = await checkMagicLinkRateLimit(ip, email)
    if (rl.limited) {
      if (rl.reason === 'backend') {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again shortly.' },
          { status: 503, headers: corsHeaders }
        )
      }
      // Unified message for ip/email -- distinguishing them would let a caller
      // probe whether a given address has recently requested a link.
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders }
      )
    }

    // 检查环境变量
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      serverLogger.error('Missing Supabase environment variables')
      return NextResponse.json({
        error: 'Server configuration error'
      }, {
        status: 500,
        headers: corsHeaders
      })
    }

    // 使用Supabase原生Magic Link
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.domain.financial'}/auth/magic-link`

    logger.debug('Sending magic link (email redacted)')

    const { error } = await supabase.auth.signInWithOtp({
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

    logger.debug('Magic link sent successfully')

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
      headers: getCorsHeadersForError(request)
    })
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request)
  })
}
