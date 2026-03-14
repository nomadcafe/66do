import { NextRequest, NextResponse } from 'next/server'
import { TransactionService, type TransactionInsert } from '../../../src/lib/supabaseService'
import { validateTransaction, sanitizeTransactionData } from '../../../src/lib/validation'
import { getAuthInfoFromRequest } from '../../../src/lib/auth-helper'
import { createAuthenticatedSupabaseClient } from '../../../src/lib/supabaseAuthClient'
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors'
import { MAX_BULK_OPERATION_SIZE } from '../../../src/lib/constants'

function buildTransactionInsertPayload(
  sanitizedTransaction: Record<string, unknown>,
  userId: string
): TransactionInsert {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    domain_id: sanitizedTransaction.domain_id as string,
    type: sanitizedTransaction.type as string,
    amount: Number(sanitizedTransaction.amount),
    currency: (sanitizedTransaction.currency as string) || 'USD',
    exchange_rate: Number(sanitizedTransaction.exchange_rate) || 1,
    date: sanitizedTransaction.date as string,
    base_amount: sanitizedTransaction.base_amount != null ? Number(sanitizedTransaction.base_amount) : null,
    platform_fee: sanitizedTransaction.platform_fee != null ? Number(sanitizedTransaction.platform_fee) : null,
    platform_fee_percentage: sanitizedTransaction.platform_fee_percentage != null ? Number(sanitizedTransaction.platform_fee_percentage) : null,
    net_amount: sanitizedTransaction.net_amount != null ? Number(sanitizedTransaction.net_amount) : null,
    category: (sanitizedTransaction.category as string) || null,
    tax_deductible: Boolean(sanitizedTransaction.tax_deductible),
    receipt_url: (sanitizedTransaction.receipt_url as string) || null,
    notes: (sanitizedTransaction.notes as string) || null
  }
}

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

    const corsHeaders = getCorsHeaders(request)
    const client = await createAuthenticatedSupabaseClient(authInfo.accessToken)
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
    const { transaction, transactions } = body

    const authInfo = await getAuthInfoFromRequest(request)
    if (!authInfo?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = getCorsHeaders(request)
    const client = await createAuthenticatedSupabaseClient(authInfo.accessToken)
    const userId = authInfo.userId

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
    const result = await TransactionService.createTransactionWithClient(client, payload)
    const newTransaction = result.data
    const insertError = result.error
    if (insertError || !newTransaction) {
      return NextResponse.json(
        {
          error: 'Failed to create transaction in database',
          details: insertError || 'Unknown error'
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

// PATCH /api/transactions - 批量更新交易
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactions } = body

    const authInfo = await getAuthInfoFromRequest(request)
    if (!authInfo?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = getCorsHeaders(request)
    const client = await createAuthenticatedSupabaseClient(authInfo.accessToken)
    const userId = authInfo.userId

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json({ error: 'Transactions array is required' }, {
        status: 400,
        headers: corsHeaders
      })
    }

    if (transactions.length > MAX_BULK_OPERATION_SIZE) {
      return NextResponse.json({
        error: `Bulk update is limited to ${MAX_BULK_OPERATION_SIZE} transactions at a time`
      }, {
        status: 400,
        headers: corsHeaders
      })
    }

    const allUserTransactions = await TransactionService.getTransactionsWithClient(client, userId)
    const userTransactionIds = new Set(allUserTransactions.map(t => t.id))

    const invalidTransactions = transactions.filter(t => {
      if (t.id && !userTransactionIds.has(t.id)) {
        return true
      }
      return false
    })

    if (invalidTransactions.length > 0) {
      return NextResponse.json({
        error: 'Some transactions do not belong to you or do not exist',
        invalidCount: invalidTransactions.length,
        invalidIds: invalidTransactions.map(t => t.id).filter(Boolean)
      }, {
        status: 403,
        headers: corsHeaders
      })
    }

    const validatedTransactions = transactions.map(t => ({
      ...sanitizeTransactionData(t),
      user_id: userId
    }))

    const bulkResult = await TransactionService.bulkUpdateTransactionsWithClient(client, validatedTransactions, userId)
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
