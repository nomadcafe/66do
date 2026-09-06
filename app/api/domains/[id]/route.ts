import { NextRequest, NextResponse } from 'next/server'
import { DomainService } from '../../../../src/lib/supabaseService'
import { validateDomain, sanitizeDomainData } from '../../../../src/lib/validation'
import { buildDomainUpdatePayload } from '../../../../src/lib/domainPayloads'
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

    // 不再先 SELECT 一次验证归属再 UPDATE：UPDATE 语句自带 .eq('user_id')，
    // 加上 domains 的 RLS，"不是你的行"根本不会被这条语句匹配到。前置查询
    // 除了多一次 DB 往返之外不提供任何额外保证（而且它和写入之间还有个
    // TOCTOU 窗口）。现在用回传的行数来分流：0 行 = 不存在或不是你的。
    const { data: updatedDomain, error: updateError } = await DomainService.updateDomainWithClient(
      authenticatedClient,
      domainId,
      updatePayload,
      userId
    )

    if (updateError) {
      const isProduction = process.env.NODE_ENV === 'production'
      console.error('Failed to update domain:', updateError)
      return NextResponse.json({
        error: 'Failed to update domain',
        ...(isProduction ? {} : { details: updateError.message })
      }, {
        status: 500,
        headers: corsHeaders
      })
    }

    if (!updatedDomain) {
      return NextResponse.json({
        error: 'Domain not found or access denied'
      }, {
        status: 403,
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

    // 同 PUT：DELETE 语句自带 .eq('user_id') + RLS，归属就在这一条语句里，
    // 前置的所有权 SELECT 是多余的一次往返。用真正删掉的行数分流。
    const { deleted, error: deleteError } = await DomainService.deleteDomainWithClient(
      authenticatedClientForDelete,
      domainId,
      userId
    )

    if (deleteError) {
      const isProduction = process.env.NODE_ENV === 'production'
      console.error('Failed to delete domain:', deleteError)
      return NextResponse.json({
        error: 'Failed to delete domain',
        ...(isProduction ? {} : { details: deleteError.message })
      }, {
        status: 500,
        headers: corsHeaders
      })
    }

    if (deleted === 0) {
      return NextResponse.json({
        error: 'Domain not found or access denied'
      }, {
        status: 403,
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

