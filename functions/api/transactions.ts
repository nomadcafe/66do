// Cloudflare Pages Function for transactions API

interface Transaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'sell' | 'renew' | 'transfer' | 'fee' | 'marketing' | 'advertising';
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
  date: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export async function onRequest(context: any) {
  const { request, env } = context;
  
  try {
    const { action, userId, transaction, transactions } = await request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get D1 database from environment
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not available' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'getTransactions':
        return await getTransactions(db, userId);
      
      case 'addTransaction':
        if (!transaction) {
          return new Response(JSON.stringify({ error: 'Transaction data is required' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await addTransaction(db, userId, transaction);
      
      case 'updateTransaction':
        if (!transaction) {
          return new Response(JSON.stringify({ error: 'Transaction data is required' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await updateTransaction(db, userId, transaction);
      
      case 'deleteTransaction':
        if (!transaction?.id) {
          return new Response(JSON.stringify({ error: 'Transaction ID is required' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await deleteTransaction(db, userId, transaction.id);
      
      case 'bulkUpdateTransactions':
        if (!transactions || !Array.isArray(transactions)) {
          return new Response(JSON.stringify({ error: 'Transactions array is required' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await bulkUpdateTransactions(db, userId, transactions);
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Transaction API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function getTransactions(db: any, userId: string) {
  try {
    const result = await db.prepare(
      'SELECT * FROM domain_transactions WHERE user_id = ? ORDER BY date DESC'
    ).bind(userId).all();
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: result.results 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to get transactions' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function addTransaction(db: any, userId: string, transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  try {
    const id = Date.now().toString();
    const now = new Date().toISOString();
    
    const result = await db.prepare(`
      INSERT INTO domain_transactions (
        id, user_id, domain_id, type, amount, currency, exchange_rate,
        base_amount, platform_fee, platform_fee_percentage, net_amount,
        category, tax_deductible, receipt_url, notes, date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, userId, transaction.domain_id, transaction.type, transaction.amount,
      transaction.currency, transaction.exchange_rate, transaction.base_amount,
      transaction.platform_fee, transaction.platform_fee_percentage, transaction.net_amount,
      transaction.category, transaction.tax_deductible, transaction.receipt_url,
      transaction.notes, transaction.date, now, now
    ).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      id: result.meta.last_row_id 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error adding transaction:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to add transaction' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function updateTransaction(db: any, userId: string, transaction: Transaction) {
  try {
    const now = new Date().toISOString();
    
    const result = await db.prepare(`
      UPDATE domain_transactions SET 
        domain_id = ?, type = ?, amount = ?, currency = ?, exchange_rate = ?,
        base_amount = ?, platform_fee = ?, platform_fee_percentage = ?, net_amount = ?,
        category = ?, tax_deductible = ?, receipt_url = ?, notes = ?, date = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(
      transaction.domain_id, transaction.type, transaction.amount, transaction.currency,
      transaction.exchange_rate, transaction.base_amount, transaction.platform_fee,
      transaction.platform_fee_percentage, transaction.net_amount, transaction.category,
      transaction.tax_deductible, transaction.receipt_url, transaction.notes,
      transaction.date, now, transaction.id, userId
    ).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      changes: result.meta.changes 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to update transaction' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function deleteTransaction(db: any, userId: string, transactionId: string) {
  try {
    const result = await db.prepare(
      'DELETE FROM domain_transactions WHERE id = ? AND user_id = ?'
    ).bind(transactionId, userId).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      changes: result.meta.changes 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to delete transaction' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function bulkUpdateTransactions(db: any, userId: string, transactions: Transaction[]) {
  try {
    const now = new Date().toISOString();
    let successCount = 0;
    
    for (const transaction of transactions) {
      await db.prepare(`
        UPDATE domain_transactions SET 
          domain_id = ?, type = ?, amount = ?, currency = ?, exchange_rate = ?,
          base_amount = ?, platform_fee = ?, platform_fee_percentage = ?, net_amount = ?,
          category = ?, tax_deductible = ?, receipt_url = ?, notes = ?, date = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(
        transaction.domain_id, transaction.type, transaction.amount, transaction.currency,
        transaction.exchange_rate, transaction.base_amount, transaction.platform_fee,
        transaction.platform_fee_percentage, transaction.net_amount, transaction.category,
        transaction.tax_deductible, transaction.receipt_url, transaction.notes,
        transaction.date, now, transaction.id, userId
      ).run();
      successCount++;
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      updated: successCount 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error bulk updating transactions:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to bulk update transactions' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}