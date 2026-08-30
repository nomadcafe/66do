import { NextRequest, NextResponse } from 'next/server'
import { DomainService } from '../../../../src/lib/supabaseService'
import { validateDomain, sanitizeDomainData } from '../../../../src/lib/validation'
import { buildDomainUpdatePayload } from '../../../../src/lib/domainPayloads'
import { isDomainOwnedByUser } from '../../../../src/lib/domainOwnership'
import { getAuthInfoFromRequest } from '../../../../src/lib/auth-helper'
import { createAuthenticatedSupabaseClient } from '../../../../src/lib/supabaseAuthClient'
import { getCorsHeaders, getCorsHeadersForError } from '../../../../src/lib/cors'
import { checkUserWriteRateLimit } from '../../../../src/lib/rateLimit'

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
    
    const { userId, accessToken } = authInfo
    const corsHeaders = getCorsHeaders(request)
    const { id: domainId } = await params
    const authenticatedClient = await createAuthenticatedSupabaseClient(accessToken)
    const domain = await DomainService.getDomainByIdWithClient(authenticatedClient, domainId, userId)

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
      headers: getCorsHeadersForError(request)
    })
  }
}

// PUT /api/domains/[id] - 更新域名
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 鉴权和限流都在读 body 之前：未认证或已超限的请求不该让我们花代价把
    // 它的 payload 读进内存并解析。
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

    const domain = await request.json()

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
    const updatePayload = buildDomainUpdatePayload(sanitizedUpdateDomain)
    const authenticatedClient = await createAuthenticatedSupabaseClient(accessToken)

    // 验证域名所有权（单行查询，不受列表 1000 行上限影响）
    const canUpdate = await isDomainOwnedByUser(authenticatedClient, domainId, userId)

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
      updatePayload,
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
      headers: getCorsHeadersForError(request)
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
        headers: getCorsHeaders(request)
      })
    }
    
    const { userId, accessToken } = authInfo
    const corsHeaders = getCorsHeaders(request)
    const { id: domainId } = await params

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

    const authenticatedClientForDelete = await createAuthenticatedSupabaseClient(accessToken)
    const canDeleteDomain = await isDomainOwnedByUser(authenticatedClientForDelete, domainId, userId)

    if (!canDeleteDomain) {
      return NextResponse.json({ 
        error: 'Domain not found or access denied' 
      }, { 
        status: 403,
        headers: corsHeaders
      })
    }
    
    const deleteResult = await DomainService.deleteDomainWithClient(authenticatedClientForDelete, domainId, userId)
    
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

