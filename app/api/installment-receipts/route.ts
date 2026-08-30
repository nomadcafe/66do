import { NextRequest, NextResponse } from 'next/server'
import { InstallmentReceiptService, TransactionService } from '../../../src/lib/supabaseService'
import { validateInstallmentReceipt } from '../../../src/lib/validation'
import { buildInstallmentReceiptInsertPayload } from '../../../src/lib/installmentReceiptPayload'
import { getAuthInfoFromRequest } from '../../../src/lib/auth-helper'
import { createAuthenticatedSupabaseClient } from '../../../src/lib/supabaseAuthClient'
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors'
import { checkUserWriteRateLimit } from '../../../src/lib/rateLimit'

// POST /api/installment-receipts - 新增一笔分期收款
export async function POST(request: NextRequest) {
  try {
    // 鉴权和限流都在读 body 之前
    const authInfo = await getAuthInfoFromRequest(request)
    if (!authInfo?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const { userId, accessToken } = authInfo
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
    const receipt = (body?.receipt ?? body) as Record<string, unknown>

    const validation = validateInstallmentReceipt(receipt)
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Receipt validation failed',
        details: validation.errors
      }, {
        status: 400,
        headers: corsHeaders
      })
    }

    const client = await createAuthenticatedSupabaseClient(accessToken)

    // 父交易必须属于当前用户。RLS 只保证 user_id 列是自己的，并不阻止把收款挂到
    // 别人的 transaction_id 上——那会污染对方交易的分期进度。
    const parent = await TransactionService.getTransactionByIdWithClient(
      client,
      receipt.transaction_id as string,
      userId
    )
    if (!parent) {
      return NextResponse.json(
        { error: 'Transaction not found or does not belong to you' },
        { status: 403, headers: corsHeaders }
      )
    }

    const payload = buildInstallmentReceiptInsertPayload(receipt, userId)
    const { data, error } = await InstallmentReceiptService.createReceiptWithClient(client, payload)

    if (error || !data) {
      const isProduction = process.env.NODE_ENV === 'production'
      console.error('Installment receipt insert failed:', error)
      return NextResponse.json({
        error: 'Failed to create receipt',
        ...(isProduction ? {} : { details: error || 'Unknown error' })
      }, {
        status: 500,
        headers: corsHeaders
      })
    }

    return NextResponse.json({ success: true, data }, { headers: corsHeaders })
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
