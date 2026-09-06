import { NextRequest, NextResponse } from 'next/server'
import { DomainService } from '../../../src/lib/supabaseService'
import { isDuplicateDomainNameError } from '../../../src/lib/domainWriteErrors'
import { validateDomain, sanitizeDomainData, DUPLICATE_DOMAIN_MESSAGE_KEY } from '../../../src/lib/validation'
import { buildDomainInsertPayload } from '../../../src/lib/domainPayloads'
import { getAuthInfoFromRequest } from '../../../src/lib/auth-helper'
import { createAuthenticatedSupabaseClient } from '../../../src/lib/supabaseAuthClient'
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors'
import { MAX_BULK_OPERATION_SIZE } from '../../../src/lib/constants'
import { checkUserWriteRateLimit } from '../../../src/lib/rateLimit'

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { domain, domains } = body

    const authenticatedClient = await createAuthenticatedSupabaseClient(accessToken)

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
      // 先把整批校验完再写库。逐条"校验一条写一条"的话，中途某条不合法就会
      // 直接 return 400，而前面已经写进去的行不会回滚——客户端以为整批失败，
      // 库里却躺着一半。
      const validationErrors: string[] = []
      const payloads = []

      for (const [index, domainData] of domains.entries()) {
        const domainValidation = validateDomain(domainData)
        if (!domainValidation.valid) {
          validationErrors.push(...domainValidation.errors.map(e => `#${index + 1}: ${e}`))
          continue
        }

        const sanitizedDomain = sanitizeDomainData(domainData) as Record<string, unknown>
        payloads.push(buildDomainInsertPayload(sanitizedDomain, userId))
      }

      if (validationErrors.length > 0) {
        return NextResponse.json({
          error: 'Domain validation failed',
          details: validationErrors
        }, {
          status: 400,
          headers: corsHeaders
        })
      }

      const bulkResult = await DomainService.createDomainsWithClient(authenticatedClient, payloads)
      if (isDuplicateDomainNameError(bulkResult.error)) {
        // 批内自带重复，或与库里已有域名重名。整批未写入（单条 insert 语句原子）
        return NextResponse.json({
          error: 'Domain already exists',
          details: [DUPLICATE_DOMAIN_MESSAGE_KEY]
        }, {
          status: 409,
          headers: corsHeaders
        })
      }
      if (bulkResult.error) {
        const isProduction = process.env.NODE_ENV === 'production'
        console.error('Bulk domain insert failed:', bulkResult.error)
        return NextResponse.json({
          error: 'Failed to create domains',
          ...(isProduction ? {} : { details: bulkResult.error.message })
        }, {
          status: 500,
          headers: corsHeaders
        })
      }

      return NextResponse.json({ success: true, data: bulkResult.data }, { headers: corsHeaders })
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
    
    // 去重不再在应用层做「拉全表 → 内存比对」：那是 TOCTOU（并发两个请求会
    // 同时通过），批量分支还完全跳过。改由 domains 上的唯一索引兜底，冲突时
    // Postgres 报 23505，这里翻译成 409。
    const sanitizedDomain = sanitizeDomainData(domain) as Record<string, unknown>
    const payload = buildDomainInsertPayload(sanitizedDomain, userId)
    const { data: newDomain, error: insertError } = await DomainService.createDomainWithClient(authenticatedClient, payload)

    if (isDuplicateDomainNameError(insertError)) {
      return NextResponse.json({
        error: 'Domain already exists',
        details: [DUPLICATE_DOMAIN_MESSAGE_KEY]
      }, {
        status: 409,
        headers: corsHeaders
      })
    }

    if (insertError || !newDomain) {
      const isProduction = process.env.NODE_ENV === 'production'
      console.error('Failed to create domain:', insertError)
      return NextResponse.json({
        error: 'Failed to create domain',
        ...(isProduction ? {} : { details: insertError?.message || 'Unknown error' })
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
