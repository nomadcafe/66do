import { NextRequest, NextResponse } from 'next/server'
import { TransactionService } from '../../../../src/lib/supabaseService'
import { validateTransaction, sanitizeTransactionData } from '../../../../src/lib/validation'
import { getUserIdFromRequest } from '../../../../src/lib/auth-helper'
import { getCorsHeaders, getCorsHeadersForError } from '../../../../src/lib/cors'

// GET /api/transactions/[id] - 获取单个交易
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = getCorsHeaders(request)
    const { id: transactionId } = await params

    const userTransactions = await TransactionService.getTransactions(userId)
    const transaction = userTransactions.find(t => t.id === transactionId)
    
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
      headers: getCorsHeadersForError()
    })
  }
}

// PUT /api/transactions/[id] - 更新交易
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const transaction = body

    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = getCorsHeaders(request)
    const { id: transactionId } = await params

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
    
    const existingTransactions = await TransactionService.getTransactions(userId)
    const transactionExists = existingTransactions.some(t => t.id === transactionId)
    if (!transactionExists) {
      return NextResponse.json({ 
        error: 'Transaction not found or access denied' 
      }, { 
        status: 403,
        headers: corsHeaders
      })
    }
    
    const sanitizedUpdateTransaction = sanitizeTransactionData(transaction)
    const updatedTransaction = await TransactionService.updateTransaction(
      transactionId, 
      { ...sanitizedUpdateTransaction, user_id: userId },
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
      headers: getCorsHeadersForError()
    })
  }
}

// DELETE /api/transactions/[id] - 删除交易
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: getCorsHeaders(request)
      })
    }

    const corsHeaders = getCorsHeaders(request)
    const { id: transactionId } = await params

    const userTransactions = await TransactionService.getTransactions(userId)
    const canDelete = userTransactions.some(t => t.id === transactionId)
    if (!canDelete) {
      return NextResponse.json({ 
        error: 'Transaction not found or access denied' 
      }, { 
        status: 403,
        headers: corsHeaders
      })
    }
    
    const deleteResult = await TransactionService.deleteTransaction(transactionId, userId)
    
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

