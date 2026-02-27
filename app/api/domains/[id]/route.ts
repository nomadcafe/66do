import { NextRequest, NextResponse } from 'next/server'
import { DomainService } from '../../../../src/lib/supabaseService'
import { validateDomain, sanitizeDomainData } from '../../../../src/lib/validation'
import { getAuthInfoFromRequest } from '../../../../src/lib/auth-helper'
import { createClient } from '@supabase/supabase-js'
import { Database } from '../../../../src/lib/supabase'
import { getCorsHeaders, getCorsHeadersForError } from '../../../../src/lib/cors'
import { validateEnvVars } from '../../../../src/lib/env-validator'

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

// GET /api/domains/[id] - 获取单个域名
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authInfo = await getAuthInfoFromRequest(request);
    if (!authInfo || !authInfo.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: getCorsHeaders(request)
      })
    }
    
    const { userId, accessToken } = authInfo;
    const corsHeaders = getCorsHeaders(request)
    const { id: domainId } = await params

    const authenticatedClient = await createAuthenticatedSupabaseClient(accessToken)
    const userDomains = await DomainService.getDomainsWithClient(authenticatedClient, userId)
    const domain = userDomains.find(d => d.id === domainId)
    
    if (!domain) {
      return NextResponse.json({ 
        error: 'Domain not found or access denied' 
      }, { 
        status: 404,
        headers: corsHeaders
      })
    }
    
    return NextResponse.json({ success: true, data: domain }, { headers: corsHeaders })
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

// PUT /api/domains/[id] - 更新域名
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const domain = body

    const authInfo = await getAuthInfoFromRequest(request);
    if (!authInfo || !authInfo.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: getCorsHeaders(request)
      })
    }
    
    const { userId, accessToken } = authInfo;
    const corsHeaders = getCorsHeaders(request)
    const { id: domainId } = await params

    if (!domain) {
      return NextResponse.json({ error: 'Domain data is required' }, { 
        status: 400,
        headers: corsHeaders
      })
    }
    
    // 确保ID匹配
    if (domain.id && domain.id !== domainId) {
      return NextResponse.json({ error: 'Domain ID mismatch' }, { 
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
    
    const sanitizedUpdateDomain = sanitizeDomainData(domain)
    const authenticatedClient = await createAuthenticatedSupabaseClient(accessToken)
    
    // 验证域名所有权
    const userDomains = await DomainService.getDomainsWithClient(authenticatedClient, userId)
    const canUpdate = userDomains.some(d => d.id === domainId)
    
    if (!canUpdate) {
      return NextResponse.json({ 
        error: 'Domain not found or access denied' 
      }, { 
        status: 403,
        headers: corsHeaders
      })
    }
    
    const updatedDomain = await DomainService.updateDomainWithClient(
      authenticatedClient,
      domainId,
      sanitizedUpdateDomain,
      userId
    )
    
    if (!updatedDomain) {
      return NextResponse.json({ 
        error: 'Failed to update domain. It may not exist or you may not have permission.' 
      }, { 
        status: 404,
        headers: corsHeaders
      })
    }
    
    return NextResponse.json({ success: true, data: updatedDomain }, { headers: corsHeaders })
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

// DELETE /api/domains/[id] - 删除域名
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: domainId } = await params

    const authenticatedClientForDelete = await createAuthenticatedSupabaseClient(accessToken)
    const userDomains = await DomainService.getDomainsWithClient(authenticatedClientForDelete, userId)
    const canDeleteDomain = userDomains.some(d => d.id === domainId)
    
    if (!canDeleteDomain) {
      return NextResponse.json({ 
        error: 'Domain not found or access denied' 
      }, { 
        status: 403,
        headers: corsHeaders
      })
    }
    
    const deleteResult = await DomainService.deleteDomain(domainId, userId)
    
    if (!deleteResult) {
      return NextResponse.json({ 
        error: 'Failed to delete domain' 
      }, { 
        status: 500,
        headers: corsHeaders
      })
    }
    
    return NextResponse.json({ success: true }, { headers: corsHeaders })
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

