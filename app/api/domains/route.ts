import { NextRequest, NextResponse } from 'next/server'
import { DomainService } from '../../../src/lib/supabaseService'
import { validateDomain, sanitizeDomainData } from '../../../src/lib/validation'
import { getAuthInfoFromRequest } from '../../../src/lib/auth-helper'
import { createClient } from '@supabase/supabase-js'
import { Database } from '../../../src/lib/supabase'
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors'
import { validateEnvVars } from '../../../src/lib/env-validator'
import { MAX_BULK_OPERATION_SIZE } from '../../../src/lib/constants'

// 创建带有用户认证的 Supabase 客户端
async function createAuthenticatedSupabaseClient(accessToken?: string) {
  const envValidation = validateEnvVars(true)
  if (!envValidation.valid) {
    throw new Error(`Missing required environment variables: ${envValidation.missing.join(', ')}`)
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`
      } : {}
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  
  if (accessToken) {
    try {
      await client.auth.setSession({
        access_token: accessToken,
        refresh_token: '',
      });
    } catch (err) {
      console.error('Error setting session in Supabase client:', err);
    }
  }
  
  return client
}

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
    
    const { userId, accessToken } = authInfo;
    const corsHeaders = getCorsHeaders(request)
    
    const authenticatedClient = await createAuthenticatedSupabaseClient(accessToken)
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
    const { domain, domains } = body

    const authInfo = await getAuthInfoFromRequest(request);
    if (!authInfo || !authInfo.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const { userId, accessToken } = authInfo;
    const corsHeaders = getCorsHeaders(request)

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

      const authenticatedClient = await createAuthenticatedSupabaseClient(accessToken)
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
        const tagsForDb = Array.isArray(sanitizedDomain.tags)
          ? JSON.stringify(sanitizedDomain.tags)
          : (typeof sanitizedDomain.tags === 'string' ? sanitizedDomain.tags : '[]')
        const status = ['active', 'for_sale', 'sold', 'expired'].includes((sanitizedDomain.status as string) || '')
          ? (sanitizedDomain.status as string)
          : 'active'
        const newDomain = await DomainService.createDomainWithClient(authenticatedClient, { 
          ...sanitizedDomain, 
          tags: tagsForDb,
          status,
          user_id: userId,
          id: crypto.randomUUID(),
          domain_name: (sanitizedDomain.domain_name as string) || ''
        })
        
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
    
    const authenticatedClientForCheck = await createAuthenticatedSupabaseClient(accessToken)
    const existingDomains = await DomainService.getDomainsWithClient(authenticatedClientForCheck, userId)
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
    const tagsForDb = Array.isArray(sanitizedDomain.tags)
      ? JSON.stringify(sanitizedDomain.tags)
      : (typeof sanitizedDomain.tags === 'string' ? sanitizedDomain.tags : '[]')
    const status = ['active', 'for_sale', 'sold', 'expired'].includes((sanitizedDomain.status as string) || '')
      ? (sanitizedDomain.status as string)
      : 'active'
    const authenticatedClientForCreate = await createAuthenticatedSupabaseClient(accessToken)
    const newDomain = await DomainService.createDomainWithClient(authenticatedClientForCreate, { 
      ...sanitizedDomain, 
      tags: tagsForDb,
      status,
      user_id: userId,
      id: crypto.randomUUID(),
      domain_name: (sanitizedDomain.domain_name as string) || ''
    })
    
    if (!newDomain) {
      console.error('Failed to create domain via Supabase - see server logs for details')
      return NextResponse.json({ 
        error: 'Failed to create domain in Supabase. Please check RLS policies or field values.' 
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

// PATCH /api/domains - 批量更新域名
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { domains } = body

    const authInfo = await getAuthInfoFromRequest(request);
    if (!authInfo || !authInfo.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const { userId } = authInfo;
    const corsHeaders = getCorsHeaders(request)

    if (!domains || !Array.isArray(domains)) {
      return NextResponse.json({ error: 'Domains array is required' }, { 
        status: 400,
        headers: corsHeaders
      })
    }

    // 验证所有域名都属于当前用户
    const authenticatedClient = await createAuthenticatedSupabaseClient(authInfo.accessToken)
    const userDomains = await DomainService.getDomainsWithClient(authenticatedClient, userId)
    const userDomainIds = new Set(userDomains.map(d => d.id))
    
    const invalidDomains = domains.filter(d => d.id && !userDomainIds.has(d.id))
    if (invalidDomains.length > 0) {
      return NextResponse.json({ 
        error: 'Some domains do not belong to you or do not exist',
        invalidCount: invalidDomains.length
      }, { 
        status: 403,
        headers: corsHeaders
      })
    }

    const bulkResult = await DomainService.bulkUpdateDomains(domains.map(d => {
      const tagsForDb = Array.isArray(d.tags)
        ? JSON.stringify(d.tags)
        : (typeof d.tags === 'string' ? d.tags : '[]')
      return {
        ...d,
        tags: tagsForDb,
        user_id: userId
      }
    }))
    
    return NextResponse.json({ success: bulkResult }, { headers: corsHeaders })
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
