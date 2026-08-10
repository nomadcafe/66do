import { NextRequest, NextResponse } from 'next/server'
import { InstallmentReceiptService } from '../../../../src/lib/supabaseService'
import { validateInstallmentReceipt } from '../../../../src/lib/validation'
import { buildInstallmentReceiptUpdatePayload } from '../../../../src/lib/installmentReceiptPayload'
import { getAuthInfoFromRequest } from '../../../../src/lib/auth-helper'
import { createAuthenticatedSupabaseClient } from '../../../../src/lib/supabaseAuthClient'
import { getCorsHeaders, getCorsHeadersForError } from '../../../../src/lib/cors'
import { checkUserWriteRateLimit } from '../../../../src/lib/rateLimit'

/** 鉴权 + 限流 + 取出这条收款（并确认归属）。三个 handler 共用。 */
async function resolveOwnedReceipt(request: NextRequest, receiptId: string) {
  const authInfo = await getAuthInfoFromRequest(request)
  if (!authInfo?.userId) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: getCorsHeaders(request)
      })
    }
  }

  const { userId, accessToken } = authInfo
  const corsHeaders = getCorsHeaders(request)

  const rl = await checkUserWriteRateLimit(userId)
  if (rl.limited) {
    if (rl.reason === 'backend') {
      return {
        error: NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again shortly.' },
          { status: 503, headers: corsHeaders }
        )
      }
    }
    return {
      error: NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders }
      )
    }
  }

  const refreshToken = request.headers.get('X-Refresh-Token') ?? undefined
  const client = await createAuthenticatedSupabaseClient(accessToken, refreshToken)
  const existing = await InstallmentReceiptService.getReceiptByIdWithClient(client, receiptId, userId)

  if (!existing) {
    return {
      error: NextResponse.json({ error: 'Receipt not found or access denied' }, {
        status: 404,
        headers: corsHeaders
      })
    }
  }

  return { userId, client, corsHeaders, existing }
}

// PUT /api/installment-receipts/[id] - 修改一笔分期收款
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: receiptId } = await params
    const resolved = await resolveOwnedReceipt(request, receiptId)
    if (resolved.error) return resolved.error

    const { userId, client, corsHeaders, existing } = resolved
    const body = await request.json()
    const receipt = (body?.receipt ?? body) as Record<string, unknown>

    // 用库里的 transaction_id 参与校验，而不是客户端传来的：归属不可改，
    // 想换交易就删了重建。
    const validation = validateInstallmentReceipt({
      ...receipt,
      transaction_id: existing.transaction_id,
    })
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Receipt validation failed',
        details: validation.errors
      }, {
        status: 400,
        headers: corsHeaders
      })
    }

    const updates = buildInstallmentReceiptUpdatePayload(receipt)
    const updated = await InstallmentReceiptService.updateReceiptWithClient(
      client,
      receiptId,
      updates,
      userId
    )

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update receipt' }, {
        status: 500,
        headers: corsHeaders
      })
    }

    return NextResponse.json({ success: true, data: updated }, { headers: corsHeaders })
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

// DELETE /api/installment-receipts/[id] - 删除一笔分期收款
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: receiptId } = await params
    const resolved = await resolveOwnedReceipt(request, receiptId)
    if (resolved.error) return resolved.error

    const { userId, client, corsHeaders } = resolved
    const deleted = await InstallmentReceiptService.deleteReceiptWithClient(client, receiptId, userId)

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete receipt' }, {
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
