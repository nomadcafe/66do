// 数据迁移服务 - 从localStorage迁移到D1数据库

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
}

interface MigrationResult {
  success: boolean;
  domainsMigrated: number;
  transactionsMigrated: number;
  errors: string[];
}

// 从localStorage获取数据
export function getLocalStorageData() {
  try {
    const domains = JSON.parse(localStorage.getItem('66do_domains') || '[]');
    const transactions = JSON.parse(localStorage.getItem('66do_transactions') || '[]');
    
    return { domains, transactions };
  } catch (error) {
    console.error('Error reading localStorage data:', error);
    return { domains: [], transactions: [] };
  }
}

// 迁移域名数据到D1数据库
export async function migrateDomainsToD1(userId: string, domains: Domain[]): Promise<{ success: boolean; count: number; errors: string[] }> {
  const errors: string[] = [];
  let successCount = 0;

  try {
    for (const domain of domains) {
      try {
        const response = await fetch('/api/domains', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'addDomain',
            userId,
            domain: {
              domain_name: domain.domain_name,
              registrar: domain.registrar,
              purchase_date: domain.purchase_date,
              purchase_cost: domain.purchase_cost,
              renewal_cost: domain.renewal_cost,
              renewal_cycle: domain.renewal_cycle,
              renewal_count: domain.renewal_count,
              next_renewal_date: domain.next_renewal_date,
              expiry_date: domain.expiry_date,
              status: domain.status,
              estimated_value: domain.estimated_value,
              sale_date: domain.sale_date,
              sale_price: domain.sale_price,
              platform_fee: domain.platform_fee,
              tags: domain.tags
            }
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          const errorData = await response.json();
          errors.push(`Domain ${domain.domain_name}: ${errorData.error}`);
        }
      } catch (error) {
        errors.push(`Domain ${domain.domain_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success: successCount > 0, count: successCount, errors };
  } catch (error) {
    console.error('Error migrating domains:', error);
    return { success: false, count: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] };
  }
}

// 迁移交易数据到D1数据库
export async function migrateTransactionsToD1(userId: string, transactions: Transaction[]): Promise<{ success: boolean; count: number; errors: string[] }> {
  const errors: string[] = [];
  let successCount = 0;

  try {
    for (const transaction of transactions) {
      try {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'addTransaction',
            userId,
            transaction: {
              domain_id: transaction.domain_id,
              type: transaction.type,
              amount: transaction.amount,
              currency: transaction.currency,
              exchange_rate: transaction.exchange_rate,
              base_amount: transaction.base_amount,
              platform_fee: transaction.platform_fee,
              platform_fee_percentage: transaction.platform_fee_percentage,
              net_amount: transaction.net_amount,
              category: transaction.category,
              tax_deductible: transaction.tax_deductible,
              receipt_url: transaction.receipt_url,
              notes: transaction.notes,
              transaction_date: transaction.transaction_date
            }
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          const errorData = await response.json();
          errors.push(`Transaction ${transaction.id}: ${errorData.error}`);
        }
      } catch (error) {
        errors.push(`Transaction ${transaction.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success: successCount > 0, count: successCount, errors };
  } catch (error) {
    console.error('Error migrating transactions:', error);
    return { success: false, count: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] };
  }
}

// 完整数据迁移
export async function migrateAllDataToD1(userId: string): Promise<MigrationResult> {
  console.log('Starting data migration to D1 database...');
  
  const { domains, transactions } = getLocalStorageData();
  const errors: string[] = [];
  
  // 迁移域名数据
  const domainResult = await migrateDomainsToD1(userId, domains);
  if (!domainResult.success) {
    errors.push(...domainResult.errors);
  }
  
  // 迁移交易数据
  const transactionResult = await migrateTransactionsToD1(userId, transactions);
  if (!transactionResult.success) {
    errors.push(...transactionResult.errors);
  }
  
  const success = domainResult.success && transactionResult.success;
  
  console.log('Data migration completed:', {
    success,
    domainsMigrated: domainResult.count,
    transactionsMigrated: transactionResult.count,
    errors: errors.length
  });
  
  return {
    success,
    domainsMigrated: domainResult.count,
    transactionsMigrated: transactionResult.count,
    errors
  };
}

// 清理localStorage数据（迁移成功后）
export function cleanupLocalStorageData() {
  try {
    localStorage.removeItem('66do_domains');
    localStorage.removeItem('66do_transactions');
    localStorage.removeItem('66do_backup');
    console.log('LocalStorage data cleaned up successfully');
  } catch (error) {
    console.error('Error cleaning up localStorage:', error);
  }
}

// 检查是否需要迁移
export function needsMigration(): boolean {
  const domains = localStorage.getItem('66do_domains');
  const transactions = localStorage.getItem('66do_transactions');
  
  return !!(domains || transactions);
}

// 备份localStorage数据
export function backupLocalStorageData() {
  try {
    const domains = localStorage.getItem('66do_domains');
    const transactions = localStorage.getItem('66do_transactions');
    
    const backup = {
      domains: domains ? JSON.parse(domains) : [],
      transactions: transactions ? JSON.parse(transactions) : [],
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('66do_migration_backup', JSON.stringify(backup));
    console.log('LocalStorage data backed up');
    return true;
  } catch (error) {
    console.error('Error backing up localStorage data:', error);
    return false;
  }
}
