import { NextRequest, NextResponse } from 'next/server';

interface Transaction {
  id: string;
  domain_id: string;
  user_id: string;
  type: 'purchase' | 'renewal' | 'sell' | 'expense' | 'income' | 'marketing' | 'advertising';
  amount: number;
  currency: string;
  exchange_rate?: number;
  base_amount?: number;
  platform_fee?: number;
  platform_fee_percentage?: number;
  net_amount?: number;
  category?: string;
  tax_deductible?: boolean;
  receipt_url?: string;
  notes: string;
  transaction_date: string;
  created_at: string;
  updated_at: string;
}

export async function POST(request: NextRequest) {
  try {
    const { action, userId, transaction, transactions } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    switch (action) {
      case 'getTransactions':
        return await getTransactions(userId);
      
      case 'addTransaction':
        if (!transaction) {
          return NextResponse.json({ error: 'Transaction data is required' }, { status: 400 });
        }
        return await addTransaction(userId, transaction);
      
      case 'updateTransaction':
        if (!transaction) {
          return NextResponse.json({ error: 'Transaction data is required' }, { status: 400 });
        }
        return await updateTransaction(userId, transaction);
      
      case 'deleteTransaction':
        if (!transaction?.id) {
          return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
        }
        return await deleteTransaction(userId, transaction.id);
      
      case 'bulkUpdate':
        if (!transactions) {
          return NextResponse.json({ error: 'Transactions data is required' }, { status: 400 });
        }
        return await bulkUpdateTransactions(userId, transactions);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Transaction API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getTransactions(userId: string) {
  try {
    const result = await (globalThis as any).env.DB.prepare(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC'
    ).bind(userId).all();

    return NextResponse.json({ 
      success: true, 
      transactions: result.results || [] 
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    return NextResponse.json({ error: 'Failed to get transactions' }, { status: 500 });
  }
}

async function addTransaction(userId: string, transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const result = await (globalThis as any).env.DB.prepare(`
      INSERT INTO transactions (
        id, user_id, domain_id, type, amount, currency, exchange_rate,
        base_amount, platform_fee, platform_fee_percentage, net_amount,
        category, tax_deductible, receipt_url, notes, transaction_date,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, userId, transaction.domain_id, transaction.type, transaction.amount,
      transaction.currency, transaction.exchange_rate || null,
      transaction.base_amount || null, transaction.platform_fee || null,
      transaction.platform_fee_percentage || null, transaction.net_amount || null,
      transaction.category || null, transaction.tax_deductible || false,
      transaction.receipt_url || null, transaction.notes, transaction.transaction_date,
      now, now
    ).run();

    return NextResponse.json({ 
      success: true, 
      transaction: { ...transaction, id, user_id: userId, created_at: now, updated_at: now }
    });
  } catch (error) {
    console.error('Error adding transaction:', error);
    return NextResponse.json({ error: 'Failed to add transaction' }, { status: 500 });
  }
}

async function updateTransaction(userId: string, transaction: Transaction) {
  try {
    const now = new Date().toISOString();
    
    const result = await (globalThis as any).env.DB.prepare(`
      UPDATE transactions SET
        domain_id = ?, type = ?, amount = ?, currency = ?, exchange_rate = ?,
        base_amount = ?, platform_fee = ?, platform_fee_percentage = ?,
        net_amount = ?, category = ?, tax_deductible = ?, receipt_url = ?,
        notes = ?, transaction_date = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(
      transaction.domain_id, transaction.type, transaction.amount, transaction.currency,
      transaction.exchange_rate || null, transaction.base_amount || null,
      transaction.platform_fee || null, transaction.platform_fee_percentage || null,
      transaction.net_amount || null, transaction.category || null,
      transaction.tax_deductible || false, transaction.receipt_url || null,
      transaction.notes, transaction.transaction_date, now, transaction.id, userId
    ).run();

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Transaction not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      transaction: { ...transaction, updated_at: now }
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

async function deleteTransaction(userId: string, transactionId: string) {
  try {
    const result = await (globalThis as any).env.DB.prepare(
      'DELETE FROM transactions WHERE id = ? AND user_id = ?'
    ).bind(transactionId, userId).run();

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Transaction not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}

async function bulkUpdateTransactions(userId: string, transactions: Transaction[]) {
  try {
    const now = new Date().toISOString();
    
    // 使用事务来确保数据一致性
    const statements = transactions.map(transaction => 
      (globalThis as any).env.DB.prepare(`
        UPDATE transactions SET
          domain_id = ?, type = ?, amount = ?, currency = ?, exchange_rate = ?,
          base_amount = ?, platform_fee = ?, platform_fee_percentage = ?,
          net_amount = ?, category = ?, tax_deductible = ?, receipt_url = ?,
          notes = ?, transaction_date = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(
        transaction.domain_id, transaction.type, transaction.amount, transaction.currency,
        transaction.exchange_rate || null, transaction.base_amount || null,
        transaction.platform_fee || null, transaction.platform_fee_percentage || null,
        transaction.net_amount || null, transaction.category || null,
        transaction.tax_deductible || false, transaction.receipt_url || null,
        transaction.notes, transaction.transaction_date, now, transaction.id, userId
      )
    );

    await (globalThis as any).env.DB.batch(statements);

    return NextResponse.json({ 
      success: true, 
      transactions: transactions.map(t => ({ ...t, updated_at: now }))
    });
  } catch (error) {
    console.error('Error bulk updating transactions:', error);
    return NextResponse.json({ error: 'Failed to bulk update transactions' }, { status: 500 });
  }
}