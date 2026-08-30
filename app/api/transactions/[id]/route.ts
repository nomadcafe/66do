import { NextRequest, NextResponse } from 'next/server'
import { TransactionService } from '../../../../src/lib/supabaseService'
import { validateTransaction, sanitizeTransactionData } from '../../../../src/lib/validation'
import { buildTransactionUpdatePayload } from '../../../../src/lib/transactionInsertPayload'
import { getAuthInfoFromRequest } from '../../../../src/lib/auth-helper'
import { createAuthenticatedSupabaseClient } from '../../../../src/lib/supabaseAuthClient'
import { getCorsHeaders, getCorsHeadersForError } from '../../../../src/lib/cors'
import { isDomainOwnedByUser } from '../../../../src/lib/domainOwnership'
import { checkUserWriteRateLimit } from '../../../../src/lib/rateLimit'

// GET /api/transactions/[id] - 获取单个交易
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authInfo = await getAuthInfoFromRequest(request)
    if (!authInfo?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = getCorsHeaders(request)
    const { id: transactionId } = await params
    const client = await createAuthenticatedSupabaseClient(authInfo.accessToken)
    const transaction = await TransactionService.getTransactionByIdWithClient(
      client,
      transactionId,
      authInfo.userId
    )

    if (!transaction) {
      return NextResponse.json({ 
        error: 'Transaction not found or access denied' 
      }, { 
        status: 404,
        headers: corsHeaders
      })
    }
    
    return NextResponse.json({ success: true, data: transaction }, { headers: corsHeaders })
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

// PUT /api/transactions/[id] - 更新交易
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: transactionId } = await params
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

    const transaction = await request.json()

    const client = await createAuthenticatedSupabaseClient(authInfo.accessToken)

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction data is required' }, {
        status: 400,
        headers: corsHeaders
      })
    }

    // 确保ID匹配
    if (transaction.id && transaction.id !== transactionId) {
      return NextResponse.json({ error: 'Transaction ID mismatch' }, {
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

    const existingRow = await TransactionService.getTransactionByIdWithClient(client, transactionId, userId)
    if (!existingRow) {
      return NextResponse.json({
        error: 'Transaction not found or access denied'
      }, {
        status: 403,
        headers: corsHeaders
      })
    }

    const sanitizedUpdateTransaction = sanitizeTransactionData(transaction)
    const nextDomainId =
      typeof sanitizedUpdateTransaction.domain_id === 'string' &&
      sanitizedUpdateTransaction.domain_id.trim()
        ? sanitizedUpdateTransaction.domain_id.trim()
        : existingRow.domain_id
    if (!(await isDomainOwnedByUser(client, nextDomainId, userId))) {
      return NextResponse.json(
        { error: 'Domain not found or does not belong to you' },
        { status: 403, headers: corsHeaders }
      )
    }
    // 用白名单 payload，避免任何 client-only 字段（receipts、renewal_years_use_custom、
    // extend_domain_expiry_on_renew 等）漏到 supabase update。之前 spread sanitized
    // 直接交给 PostgREST，多一个不存在的列就让整个 update 静默失败 → 这里回 404。
    const updatePayload = buildTransactionUpdatePayload(sanitizedUpdateTransaction)
    const updatedTransaction = await TransactionService.updateTransactionWithClient(
      client,
      transactionId,
      updatePayload,
      userId
    )
    
    if (!updatedTransaction) {
      return NextResponse.json({ 
        error: 'Failed to update transaction. It may not exist or you may not have permission.' 
      }, { 
        status: 404,
        headers: corsHeaders
      })
    }
    
    return NextResponse.json({ success: true, data: updatedTransaction }, { headers: corsHeaders })
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

// DELETE /api/transactions/[id] - 删除交易
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authInfo = await getAuthInfoFromRequest(request)
    if (!authInfo?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = getCorsHeaders(request)
    const { id: transactionId } = await params
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

    const client = await createAuthenticatedSupabaseClient(authInfo.accessToken)

    const rowToDelete = await TransactionService.getTransactionByIdWithClient(client, transactionId, userId)
    if (!rowToDelete) {
      return NextResponse.json({
        error: 'Transaction not found or access denied'
      }, {
        status: 403,
        headers: corsHeaders
      })
    }

    const deleteResult = await TransactionService.deleteTransactionWithClient(client, transactionId, userId)
    
    if (!deleteResult) {
      return NextResponse.json({ 
        error: 'Failed to delete transaction' 
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

