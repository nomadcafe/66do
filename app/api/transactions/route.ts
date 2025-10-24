import { NextRequest, NextResponse } from 'next/server'
import { TransactionService } from '../../../src/lib/supabaseService'

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
        const newTransaction = await TransactionService.createTransaction({ ...transaction, user_id: userId })
        return NextResponse.json({ success: true, data: newTransaction }, { headers: corsHeaders })
      
      case 'updateTransaction':
        if (!transaction) {
          return NextResponse.json({ error: 'Transaction data is required' }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        const updatedTransaction = await TransactionService.updateTransaction(transaction.id, transaction)
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

export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}
