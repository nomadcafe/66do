import { NextRequest, NextResponse } from 'next/server'
import { TransactionService } from '../../../src/lib/supabaseService'
import { validateTransaction, sanitizeTransactionData } from '../../../src/lib/validation'
import { getUserIdFromRequest } from '../../../src/lib/auth-helper'
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors'
import { MAX_BULK_OPERATION_SIZE } from '../../../src/lib/constants'

// GET /api/transactions - 获取所有交易
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = getCorsHeaders(request)
    const transactionList = await TransactionService.getTransactions(userId)
    
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

    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = getCorsHeaders(request)

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
        const newTransaction = await TransactionService.createTransaction({ 
          ...sanitizedTransaction, 
          user_id: userId,
          id: crypto.randomUUID(),
          domain_id: sanitizedTransaction.domain_id as string,
          type: sanitizedTransaction.type as string,
          amount: sanitizedTransaction.amount as number,
          currency: sanitizedTransaction.currency as string,
          date: sanitizedTransaction.date as string
        })
        
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
    const newTransaction = await TransactionService.createTransaction({ 
      ...sanitizedTransaction, 
      user_id: userId,
      id: crypto.randomUUID(),
      domain_id: sanitizedTransaction.domain_id as string,
      type: sanitizedTransaction.type as string,
      amount: sanitizedTransaction.amount as number,
      currency: sanitizedTransaction.currency as string,
      date: sanitizedTransaction.date as string
    })
    
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

    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = getCorsHeaders(request)

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
    
    const allUserTransactions = await TransactionService.getTransactions(userId)
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
    
    const bulkResult = await TransactionService.bulkUpdateTransactions(validatedTransactions, userId)
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
