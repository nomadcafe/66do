import { NextRequest, NextResponse } from 'next/server'
import { DomainService } from '../../../src/lib/supabaseService'
import { validateDomain, sanitizeDomainData } from '../../../src/lib/validation'
import { buildDomainInsertPayload } from '../../../src/lib/domainPayloads'
import { getAuthInfoFromRequest } from '../../../src/lib/auth-helper'
import { createAuthenticatedSupabaseClient } from '../../../src/lib/supabaseAuthClient'
import { getCorsHeaders, getCorsHeadersForError, noCacheHeaders } from '../../../src/lib/cors'
import { MAX_BULK_OPERATION_SIZE } from '../../../src/lib/constants'
import { checkUserWriteRateLimit } from '../../../src/lib/rateLimit'

// GET /api/domains - 获取所有域名
export async function GET(request: NextRequest) {
  try {
    const authInfo = await getAuthInfoFromRequest(request);
    if (!authInfo || !authInfo.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const { userId, accessToken } = authInfo
    const refreshToken = request.headers.get('X-Refresh-Token') ?? undefined
    const corsHeaders = { ...getCorsHeaders(request), ...noCacheHeaders }
    const authenticatedClient = await createAuthenticatedSupabaseClient(accessToken, refreshToken)
    const domainList = await DomainService.getDomainsWithClient(authenticatedClient, userId)
    
    return NextResponse.json({ success: true, data: domainList }, { headers: corsHeaders })
  } catch (error) {
    const isProduction = process.env.NODE_ENV === 'production'
    console.error('API Error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      ...(isProduction ? {} : { details: error instanceof Error ? error.message : 'Unknown error' })
    }, {
      status: 500,
      headers: getCorsHeadersForError()
    })
  }
}

// POST /api/domains - 创建新域名
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { domain, domains, refreshToken } = body

    const authInfo = await getAuthInfoFromRequest(request);
    if (!authInfo || !authInfo.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { userId, accessToken } = authInfo;
    const corsHeaders = getCorsHeaders(request)

    const rl = await checkUserWriteRateLimit(userId)
    if (rl.limited) {
      if (rl.reason === 'backend') {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again shortly.' },
          { status: 503, headers: corsHeaders }
        )
      }
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders }
      )
    }

    const authenticatedClient = await createAuthenticatedSupabaseClient(accessToken, refreshToken)

    // 支持批量创建
    if (domains && Array.isArray(domains)) {
      if (domains.length > MAX_BULK_OPERATION_SIZE) {
        return NextResponse.json({ 
          error: `Bulk create is limited to ${MAX_BULK_OPERATION_SIZE} domains at a time` 
        }, { 
          status: 400,
          headers: corsHeaders
        })
      }
      const createdDomains = []
      
      for (const domainData of domains) {
        const domainValidation = validateDomain(domainData)
        if (!domainValidation.valid) {
          return NextResponse.json({ 
            error: 'Domain validation failed', 
            details: domainValidation.errors 
          }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        
        const sanitizedDomain = sanitizeDomainData(domainData) as Record<string, unknown>
        const payload = buildDomainInsertPayload(sanitizedDomain, userId)
        const newDomain = await DomainService.createDomainWithClient(authenticatedClient, payload)

        if (newDomain) {
          createdDomains.push(newDomain)
        }
      }
      
      return NextResponse.json({ success: true, data: createdDomains }, { headers: corsHeaders })
    }

    // 单个域名创建
    if (!domain) {
      return NextResponse.json({ error: 'Domain data is required' }, { 
        status: 400,
        headers: corsHeaders
      })
    }
    
    const domainValidation = validateDomain(domain)
    if (!domainValidation.valid) {
      return NextResponse.json({ 
        error: 'Domain validation failed', 
        details: domainValidation.errors 
      }, { 
        status: 400,
        headers: corsHeaders
      })
    }
    
    const existingDomains = await DomainService.getDomainsWithClient(authenticatedClient, userId)
    const domainName = domain.domain_name?.toLowerCase().trim()
    const isDuplicate = existingDomains.some(d => 
      d.domain_name.toLowerCase().trim() === domainName
    )
    
    if (isDuplicate) {
      return NextResponse.json({ 
        error: 'Domain already exists', 
        details: ['This domain name is already in your portfolio']
      }, { 
        status: 409,
        headers: corsHeaders
      })
    }
    
    const sanitizedDomain = sanitizeDomainData(domain) as Record<string, unknown>
    const payload = buildDomainInsertPayload(sanitizedDomain, userId)
    const newDomain = await DomainService.createDomainWithClient(authenticatedClient, payload)

    if (!newDomain) {
      console.error('Failed to create domain - see server logs for details')
      return NextResponse.json({
        error: 'Failed to create domain'
      }, {
        status: 500,
        headers: corsHeaders
      })
    }
    
    return NextResponse.json({ success: true, data: newDomain }, { headers: corsHeaders })
  } catch (error) {
    const isProduction = process.env.NODE_ENV === 'production'
    console.error('API Error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
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
