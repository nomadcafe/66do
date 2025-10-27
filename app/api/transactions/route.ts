import { NextRequest, NextResponse } from 'next/server'
import { TransactionService } from '../../../src/lib/supabaseService'
import { validateTransaction, sanitizeTransactionData } from '../../../src/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId, transaction, transactions } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    switch (action) {
      case 'getTransactions':
        const transactionList = await TransactionService.getTransactions(userId)
        return NextResponse.json({ success: true, data: transactionList }, { headers: corsHeaders })
      
      case 'addTransaction':
        if (!transaction) {
          return NextResponse.json({ error: 'Transaction data is required' }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        
        // 验证交易数据
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
        
        // 清理和标准化数据
        const sanitizedTransaction = sanitizeTransactionData(transaction)
        const newTransaction = await TransactionService.createTransaction({ 
          ...sanitizedTransaction, 
          user_id: userId,
          id: crypto.randomUUID(), // 生成唯一ID
          domain_id: sanitizedTransaction.domain_id as string,
          type: sanitizedTransaction.type as string,
          amount: sanitizedTransaction.amount as number,
          currency: sanitizedTransaction.currency as string,
          date: sanitizedTransaction.date as string
        })
        return NextResponse.json({ success: true, data: newTransaction }, { headers: corsHeaders })
      
      case 'updateTransaction':
        if (!transaction) {
          return NextResponse.json({ error: 'Transaction data is required' }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        
        // 验证交易数据
        const updateTransactionValidation = validateTransaction(transaction)
        if (!updateTransactionValidation.valid) {
          return NextResponse.json({ 
            error: 'Transaction validation failed', 
            details: updateTransactionValidation.errors 
          }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        
        // 清理和标准化数据
        const sanitizedUpdateTransaction = sanitizeTransactionData(transaction)
        const updatedTransaction = await TransactionService.updateTransaction(transaction.id, sanitizedUpdateTransaction)
        return NextResponse.json({ success: true, data: updatedTransaction }, { headers: corsHeaders })
      
      case 'deleteTransaction':
        if (!transaction?.id) {
          return NextResponse.json({ error: 'Transaction ID is required' }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        const deleteResult = await TransactionService.deleteTransaction(transaction.id)
        return NextResponse.json({ success: deleteResult }, { headers: corsHeaders })
      
      case 'bulkUpdateTransactions':
        if (!transactions || !Array.isArray(transactions)) {
          return NextResponse.json({ error: 'Transactions array is required' }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        const bulkResult = await TransactionService.bulkUpdateTransactions(transactions)
        return NextResponse.json({ success: bulkResult }, { headers: corsHeaders })
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { 
          status: 400,
          headers: corsHeaders
        })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}
