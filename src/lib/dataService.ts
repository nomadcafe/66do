// 数据服务 - D1数据库专用

interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number;
  renewal_count: number;
  next_renewal_date?: string;
  expiry_date?: string;
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  sale_date?: string;
  sale_price?: number;
  platform_fee?: number;
  tags: string[];
}

interface Transaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising';
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
}

interface DataServiceResult<T> {
  success: boolean;
  data: T;
  source: 'd1' | 'cache';
  error?: string;
}

// 从D1数据库加载域名数据
export async function loadDomainsFromD1(userId: string): Promise<DataServiceResult<Domain[]>> {
  try {
    const response = await fetch('/api/domains', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getDomains',
        userId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        data: result.domains || [],
        source: 'd1'
      };
    } else {
      throw new Error(result.error || 'Failed to load domains from D1');
    }
  } catch (error) {
    console.error('Error loading domains from D1:', error);
    return {
      success: false,
      data: [],
      source: 'd1',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 从D1数据库加载交易数据
export async function loadTransactionsFromD1(userId: string): Promise<DataServiceResult<Transaction[]>> {
  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getTransactions',
        userId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        data: result.transactions || [],
        source: 'd1'
      };
    } else {
      throw new Error(result.error || 'Failed to load transactions from D1');
    }
  } catch (error) {
    console.error('Error loading transactions from D1:', error);
    return {
      success: false,
      data: [],
      source: 'd1',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


// 保存域名数据到D1数据库
export async function saveDomainToD1(userId: string, domain: Omit<Domain, 'id' | 'created_at' | 'updated_at'>): Promise<DataServiceResult<Domain>> {
  try {
    const response = await fetch('/api/domains', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'addDomain',
        userId,
        domain
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        data: result.domain,
        source: 'd1'
      };
    } else {
      throw new Error(result.error || 'Failed to save domain to D1');
    }
  } catch (error) {
    console.error('Error saving domain to D1:', error);
    return {
      success: false,
      data: domain as Domain,
      source: 'd1',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 保存交易数据到D1数据库
export async function saveTransactionToD1(userId: string, transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<DataServiceResult<Transaction>> {
  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'addTransaction',
        userId,
        transaction
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        data: result.transaction,
        source: 'd1'
      };
    } else {
      throw new Error(result.error || 'Failed to save transaction to D1');
    }
  } catch (error) {
    console.error('Error saving transaction to D1:', error);
    return {
      success: false,
      data: transaction as Transaction,
      source: 'd1',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 更新域名数据到D1数据库
export async function updateDomainInD1(userId: string, domain: Domain): Promise<DataServiceResult<Domain>> {
  try {
    const response = await fetch('/api/domains', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'updateDomain',
        userId,
        domain
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        data: result.domain,
        source: 'd1'
      };
    } else {
      throw new Error(result.error || 'Failed to update domain in D1');
    }
  } catch (error) {
    console.error('Error updating domain in D1:', error);
    return {
      success: false,
      data: domain,
      source: 'd1',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 更新交易数据到D1数据库
export async function updateTransactionInD1(userId: string, transaction: Transaction): Promise<DataServiceResult<Transaction>> {
  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'updateTransaction',
        userId,
        transaction
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        data: result.transaction,
        source: 'd1'
      };
    } else {
      throw new Error(result.error || 'Failed to update transaction in D1');
    }
  } catch (error) {
    console.error('Error updating transaction in D1:', error);
    return {
      success: false,
      data: transaction,
      source: 'd1',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 删除域名数据从D1数据库
export async function deleteDomainFromD1(userId: string, domainId: string): Promise<DataServiceResult<boolean>> {
  try {
    const response = await fetch('/api/domains', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'deleteDomain',
        userId,
        domain: { id: domainId }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        data: true,
        source: 'd1'
      };
    } else {
      throw new Error(result.error || 'Failed to delete domain from D1');
    }
  } catch (error) {
    console.error('Error deleting domain from D1:', error);
    return {
      success: false,
      data: false,
      source: 'd1',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 删除交易数据从D1数据库
export async function deleteTransactionFromD1(userId: string, transactionId: string): Promise<DataServiceResult<boolean>> {
  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'deleteTransaction',
        userId,
        transaction: { id: transactionId }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        data: true,
        source: 'd1'
      };
    } else {
      throw new Error(result.error || 'Failed to delete transaction from D1');
    }
  } catch (error) {
    console.error('Error deleting transaction from D1:', error);
    return {
      success: false,
      data: false,
      source: 'd1',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 检查D1数据库连接
export async function checkD1Connection(): Promise<boolean> {
  try {
    const response = await fetch('/api/domains', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getDomains',
        userId: 'test'
      })
    });

    return response.ok;
  } catch (error) {
    console.error('D1 connection check failed:', error);
    return false;
  }
}
