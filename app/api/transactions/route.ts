import { NextRequest, NextResponse } from 'next/server'
import { TransactionService } from '../../../src/lib/supabaseService'
import { validateTransaction, sanitizeTransactionData } from '../../../src/lib/validation'
import { buildTransactionInsertPayload } from '../../../src/lib/transactionInsertPayload'
import { getAuthInfoFromRequest } from '../../../src/lib/auth-helper'
import { createAuthenticatedSupabaseClient } from '../../../src/lib/supabaseAuthClient'
import { getCorsHeaders, getCorsHeadersForError, noCacheHeaders } from '../../../src/lib/cors'
import { MAX_BULK_OPERATION_SIZE } from '../../../src/lib/constants'
import { isDomainOwnedByUser } from '../../../src/lib/domainOwnership'
import { checkUserWriteRateLimit } from '../../../src/lib/rateLimit'

// GET /api/transactions - 获取所有交易
export async function GET(request: NextRequest) {
  try {
    const authInfo = await getAuthInfoFromRequest(request)
    if (!authInfo?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = { ...getCorsHeaders(request), ...noCacheHeaders }
    const client = await createAuthenticatedSupabaseClient(authInfo.accessToken, request.headers.get('X-Refresh-Token') ?? undefined)
    const transactionList = await TransactionService.getTransactionsWithClient(client, authInfo.userId)

    return NextResponse.json({ success: true, data: transactionList }, { headers: corsHeaders })
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

// POST /api/transactions - 创建新交易
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transaction, transactions, refreshToken } = body

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
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders }
      )
    }

    const client = await createAuthenticatedSupabaseClient(authInfo.accessToken, refreshToken)

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

      const createdTransactions = []

      for (const transactionData of transactions) {
        const transactionValidation = validateTransaction(transactionData)
        if (!transactionValidation.valid) {
          return NextResponse.json({
            error: 'Transaction validation failed',
            details: transactionValidation.errors
          }, {
            status: 400,
            headers: corsHeaders
          })
        }

        const sanitizedTransaction = sanitizeTransactionData(transactionData)
        const payload = buildTransactionInsertPayload(sanitizedTransaction, userId)
        if (!(await isDomainOwnedByUser(client, payload.domain_id, userId))) {
          return NextResponse.json(
            { error: 'Domain not found or does not belong to you' },
            { status: 403, headers: corsHeaders }
          )
        }
        const { data: newTransaction } = await TransactionService.createTransactionWithClient(client, payload)

        if (newTransaction) {
          createdTransactions.push(newTransaction)
        }
      }

      return NextResponse.json({ success: true, data: createdTransactions }, { headers: corsHeaders })
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
        { status: 500, headers: getCorsHeadersForError() }
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
