import { NextRequest, NextResponse } from 'next/server'
import { TransactionService } from '../../../src/lib/supabaseService'
import { validateTransaction, sanitizeTransactionData } from '../../../src/lib/validation'
import { getUserIdFromRequest } from '../../../src/lib/auth-helper'
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, transaction, transactions } = body

    // 验证用户身份
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const corsHeaders = getCorsHeaders(request)

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
        
        if (!transaction.id) {
          return NextResponse.json({ error: 'Transaction ID is required' }, { 
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
        
        // 验证交易所有权 - 确保交易属于当前用户
        const existingTransactions = await TransactionService.getTransactions(userId)
        const transactionExists = existingTransactions.some(t => t.id === transaction.id)
        if (!transactionExists) {
          return NextResponse.json({ 
            error: 'Transaction not found or access denied' 
          }, { 
            status: 403,
            headers: corsHeaders
          })
        }
        
        // 清理和标准化数据
        const sanitizedUpdateTransaction = sanitizeTransactionData(transaction)
        // 确保user_id不能被修改
        const updatedTransaction = await TransactionService.updateTransaction(
          transaction.id, 
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
      
      case 'deleteTransaction':
        if (!transaction?.id) {
          return NextResponse.json({ error: 'Transaction ID is required' }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        
        // 验证交易所有权 - 确保交易属于当前用户
        const userTransactions = await TransactionService.getTransactions(userId)
        const canDelete = userTransactions.some(t => t.id === transaction.id)
        if (!canDelete) {
          return NextResponse.json({ 
            error: 'Transaction not found or access denied' 
          }, { 
            status: 403,
            headers: corsHeaders
          })
        }
        
        const deleteResult = await TransactionService.deleteTransaction(transaction.id, userId)
        return NextResponse.json({ success: deleteResult }, { headers: corsHeaders })
      
      case 'bulkUpdateTransactions':
        if (!transactions || !Array.isArray(transactions)) {
          return NextResponse.json({ error: 'Transactions array is required' }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        
        // 限制批量操作大小，防止资源耗尽
        const MAX_BULK_SIZE = 100
        if (transactions.length > MAX_BULK_SIZE) {
          return NextResponse.json({ 
            error: `Bulk update is limited to ${MAX_BULK_SIZE} transactions at a time` 
          }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        
        // 验证所有交易的所有权 - 确保所有交易都属于当前用户
        const allUserTransactions = await TransactionService.getTransactions(userId)
        const userTransactionIds = new Set(allUserTransactions.map(t => t.id))
        
        // 检查是否有不属于当前用户的交易
        const invalidTransactions = transactions.filter(t => {
          // 如果交易有ID，必须属于当前用户
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
        
        // 确保所有交易的user_id都是当前用户，防止通过请求修改user_id
        const validatedTransactions = transactions.map(t => ({
          ...sanitizeTransactionData(t),
          user_id: userId  // 强制设置为当前用户ID
        }))
        
        const bulkResult = await TransactionService.bulkUpdateTransactions(validatedTransactions, userId)
        return NextResponse.json({ success: bulkResult }, { headers: corsHeaders })
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { 
          status: 400,
          headers: corsHeaders
        })
    }
  } catch (error) {
    // 在生产环境中不泄露详细错误信息
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
