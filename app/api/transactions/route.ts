import { NextRequest, NextResponse } from 'next/server'
import { TransactionService } from '../../../src/lib/supabaseService'
import { validateTransaction, sanitizeTransactionData } from '../../../src/lib/validation'
import { buildTransactionInsertPayload } from '../../../src/lib/transactionInsertPayload'
import { getAuthInfoFromRequest } from '../../../src/lib/auth-helper'
import { createAuthenticatedSupabaseClient } from '../../../src/lib/supabaseAuthClient'
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors'
import { MAX_BULK_OPERATION_SIZE } from '../../../src/lib/constants'
import { isDomainOwnedByUser, getOwnedDomainIds } from '../../../src/lib/domainOwnership'
import { checkUserWriteRateLimit } from '../../../src/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    // 鉴权和限流都在读 body 之前：未认证或已超限的请求不该让我们花代价把
    // 它的 payload 读进内存并解析。
    const authInfo = await getAuthInfoFromRequest(request)
    if (!authInfo?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = getCorsHeaders(request)
    const userId = authInfo.userId

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
    const { transaction, transactions } = body

    const client = await createAuthenticatedSupabaseClient(authInfo.accessToken)

    // 支持批量创建
    if (transactions && Array.isArray(transactions)) {
      if (transactions.length > MAX_BULK_OPERATION_SIZE) {
        return NextResponse.json({
          error: `Bulk create is limited to ${MAX_BULK_OPERATION_SIZE} transactions at a time`
        }, {
          status: 400,
          headers: corsHeaders
        })
      }

      // 先把整批校验 + 所有权都过一遍再写库。逐条"校验一条写一条"的话，中途某条
      // 不合法就会直接 return 400/403，而前面已经写进去的行不会回滚——客户端以为
      // 整批失败，库里却躺着一半。
      const validationErrors: string[] = []
      const payloads = []

      for (const [index, transactionData] of transactions.entries()) {
        const transactionValidation = validateTransaction(transactionData)
        if (!transactionValidation.valid) {
          validationErrors.push(...transactionValidation.errors.map(e => `#${index + 1}: ${e}`))
          continue
        }

        const sanitizedTransaction = sanitizeTransactionData(transactionData)
        payloads.push(buildTransactionInsertPayload(sanitizedTransaction, userId))
      }

      if (validationErrors.length > 0) {
        return NextResponse.json({
          error: 'Transaction validation failed',
          details: validationErrors
        }, {
          status: 400,
          headers: corsHeaders
        })
      }

      // 一次查询查完整批涉及的域名，而不是每条一次往返
      const ownedDomainIds = await getOwnedDomainIds(client, payloads.map(p => p.domain_id), userId)
      if (payloads.some(p => !p.domain_id || !ownedDomainIds.has(p.domain_id))) {
        return NextResponse.json(
          { error: 'Domain not found or does not belong to you' },
          { status: 403, headers: corsHeaders }
        )
      }

      const bulkResult = await TransactionService.createTransactionsWithClient(client, payloads)
      if (bulkResult.error) {
        const isProduction = process.env.NODE_ENV === 'production'
        console.error('Bulk transaction insert failed:', bulkResult.error)
        return NextResponse.json({
          error: 'Failed to create transactions',
          ...(isProduction ? {} : { details: bulkResult.error })
        }, {
          status: 500,
          headers: corsHeaders
        })
      }

      return NextResponse.json({ success: true, data: bulkResult.data }, { headers: corsHeaders })
    }

    // 单个交易创建
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction data is required' }, {
        status: 400,
        headers: corsHeaders
      })
    }

    const transactionValidation = validateTransaction(transaction)
    if (!transactionValidation.valid) {
      return NextResponse.json({
        error: 'Transaction validation failed',
        details: transactionValidation.errors
      }, {
        status: 400,
        headers: corsHeaders
      })
    }

    const sanitizedTransaction = sanitizeTransactionData(transaction)
    const payload = buildTransactionInsertPayload(sanitizedTransaction, userId)
    if (!(await isDomainOwnedByUser(client, payload.domain_id, userId))) {
      return NextResponse.json(
        { error: 'Domain not found or does not belong to you' },
        { status: 403, headers: corsHeaders }
      )
    }
    const result = await TransactionService.createTransactionWithClient(client, payload)
    const newTransaction = result.data
    const insertError = result.error
    if (insertError || !newTransaction) {
      const isProduction = process.env.NODE_ENV === 'production'
      console.error('Transaction insert failed:', insertError)
      return NextResponse.json(
        {
          error: 'Failed to create transaction',
          ...(isProduction ? {} : { details: insertError || 'Unknown error' })
        },
        { status: 500, headers: getCorsHeadersForError(request) }
      )
    }

    return NextResponse.json({ success: true, data: newTransaction }, { headers: corsHeaders })
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
