import { useState, useEffect, useCallback } from 'react';
import { domainCache } from '../lib/cache';
import { loadDomainsFromSupabase, loadTransactionsFromSupabase } from '../lib/supabaseService';
import {
  DomainWithTags,
  TransactionWithRequiredFields,
  ensureDomainWithTags,
  ensureTransactionWithRequiredFields
} from '../types/dashboard';
import { auditLogger } from '../lib/security';
import { validateDomain, validateTransaction } from '../lib/validation';
import { logger } from '../lib/logger';

interface LoadOptions {
  useCache?: boolean;
  showLoading?: boolean;
}

interface UseDashboardDataReturn {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
  loading: boolean;
  error: string | null;
  dataSource: 'supabase' | 'cache';
  setError: (error: string | null) => void;
  loadDashboardData: (options?: LoadOptions) => Promise<void>;
  saveData: (newDomains: DomainWithTags[], newTransactions: TransactionWithRequiredFields[]) => Promise<void>;
  refreshData: () => Promise<void>;
}

export function useDashboardData(
  userId: string | undefined,
  sessionToken: string | undefined,
  t: (key: string) => string
): UseDashboardDataReturn {
  const [domains, setDomains] = useState<DomainWithTags[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithRequiredFields[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'supabase' | 'cache'>('cache');

  const loadDashboardData = useCallback(async (options: LoadOptions = {}) => {
    if (!userId) return;

    const { useCache = true, showLoading = true } = options;
    let loadSummary = {
      domainsCount: 0,
      transactionsCount: 0,
      dataSource: (useCache ? 'cache' : 'supabase') as 'cache' | 'supabase',
    };

    try {
      if (showLoading) setLoading(true);
      setError(null);

      if (useCache) {
        const cachedDomains = domainCache.getCachedDomains(userId);
        const cachedTransactions = domainCache.getCachedTransactions(userId);

        if (cachedDomains && cachedTransactions) {
          const typedDomains = cachedDomains.map(ensureDomainWithTags);
          const typedTransactions = cachedTransactions.map(ensureTransactionWithRequiredFields);
          setDomains(typedDomains);
          setTransactions(typedTransactions);
          setDataSource('cache');

          loadSummary = {
            domainsCount: typedDomains.length,
            transactionsCount: typedTransactions.length,
            dataSource: 'cache',
          };
          if (showLoading) setLoading(false);
          return;
        }
      }

      logger.log('Loading data from Supabase database...');

      const [domainsResult, transactionsResult] = await Promise.all([
        loadDomainsFromSupabase(userId),
        loadTransactionsFromSupabase(userId),
      ]);

      if (domainsResult.success && transactionsResult.success) {
        const typedDomains = (domainsResult.data || []).map(ensureDomainWithTags);
        const typedTransactions = (transactionsResult.data || []).map(ensureTransactionWithRequiredFields);
        setDomains(typedDomains);
        setTransactions(typedTransactions);
        setDataSource('supabase');

        domainCache.cacheDomains(userId, domainsResult.data || []);
        domainCache.cacheTransactions(userId, transactionsResult.data || []);

        loadSummary = {
          domainsCount: typedDomains.length,
          transactionsCount: typedTransactions.length,
          dataSource: 'supabase',
        };

        logger.log('Data loaded from Supabase database successfully');
      } else {
        throw new Error('Failed to load data from Supabase database');
      }
    } catch (error) {
      logger.error('Error loading data from Supabase:', error);
      setError(t('common.dataLoadFailed'));
      auditLogger.log(userId || 'default', 'data_load_failed', 'dashboard', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      if (showLoading) setLoading(false);

      auditLogger.log(userId || 'default', 'data_loaded', 'dashboard', {
        domainsCount: loadSummary.domainsCount,
        transactionsCount: loadSummary.transactionsCount,
        dataSource: loadSummary.dataSource
      });
    }
  }, [userId, t]);

  const saveData = useCallback(async (
    newDomains: DomainWithTags[],
    newTransactions: TransactionWithRequiredFields[]
  ) => {
    if (!userId || !sessionToken) return;

    try {
      logger.log('Saving data to Supabase database...');

      // 验证数据完整性
      for (const domain of newDomains) {
        const validation = validateDomain(domain);
        if (!validation.valid) {
          throw new Error(`Domain validation failed: ${validation.errors.join(', ')}`);
        }
      }

      for (const transaction of newTransactions) {
        const validation = validateTransaction(transaction);
        if (!validation.valid) {
          throw new Error(`Transaction validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // 准备请求头，包含认证token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      };

      // Save domains to Supabase
      for (const domain of newDomains) {
        const isExisting = domains.find(d => d.id === domain.id);
        const domainPayload = {
          ...domain,
          registrar: domain.registrar || null,
          purchase_date: domain.purchase_date || null,
          purchase_cost: domain.purchase_cost || null,
          renewal_cost: domain.renewal_cost || null,
          next_renewal_date: domain.next_renewal_date || null,
          expiry_date: domain.expiry_date || null,
          estimated_value: domain.estimated_value || null,
          sale_date: domain.sale_date || null,
          sale_price: domain.sale_price || null,
          platform_fee: domain.platform_fee || null,
          tags: JSON.stringify(domain.tags)
        };

        let response: Response;
        if (isExisting) {
          // Update existing domain - PUT /api/domains/[id]
          response = await fetch(`/api/domains/${domain.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(domainPayload)
          });
        } else {
          // Create new domain - POST /api/domains
          response = await fetch('/api/domains', {
            method: 'POST',
            headers,
            body: JSON.stringify({ domain: domainPayload })
          });
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to ${isExisting ? 'update' : 'add'} domain: ${errorData.error || response.statusText}`);
        }
      }

      // Save transactions to Supabase
      for (const transaction of newTransactions) {
        const isExisting = transactions.find(t => t.id === transaction.id);
        const transactionPayload = {
          ...transaction,
          base_amount: transaction.base_amount || null,
          platform_fee: transaction.platform_fee || null,
          platform_fee_percentage: transaction.platform_fee_percentage || null,
          net_amount: transaction.net_amount || null,
          category: transaction.category || null,
          tax_deductible: transaction.tax_deductible || false,
          receipt_url: transaction.receipt_url || null,
          notes: transaction.notes || null
        };

        let response: Response;
        if (isExisting) {
          // Update existing transaction - PUT /api/transactions/[id]
          response = await fetch(`/api/transactions/${transaction.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(transactionPayload)
          });
        } else {
          // Create new transaction - POST /api/transactions
          response = await fetch('/api/transactions', {
            method: 'POST',
            headers,
            body: JSON.stringify({ transaction: transactionPayload })
          });
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to ${isExisting ? 'update' : 'add'} transaction: ${errorData.error || response.statusText}`);
        }
      }

      // 先清除旧缓存，确保数据一致性
      domainCache.invalidateUserCache(userId);

      // 更新本地状态
      setDomains(newDomains);
      setTransactions(newTransactions);

      // 刷新数据从Supabase，确保获取最新数据
      await loadDashboardData({ useCache: false, showLoading: false });

      logger.log('Data saved to Supabase database successfully');
    } catch (error) {
      logger.error('Error saving data to Supabase:', error);

      // 清除缓存，强制下次从数据库加载
      if (userId) {
        domainCache.invalidateUserCache(userId);
      }

      // 提供更详细的错误信息
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network');
      const isAuthError = errorMessage.includes('401') || errorMessage.includes('Unauthorized');

      if (isAuthError) {
        setError(t('common.authError') || 'Authentication failed. Please log in again.');
      } else if (isNetworkError) {
        setError(t('common.networkError') || 'Network error. Please check your connection and try again.');
      } else {
        setError(t('common.dataSaveFailed') || `Failed to save data: ${errorMessage}`);
      }

      // 记录错误到审计日志
      auditLogger.log(userId || 'unknown', 'data_save_failed', 'dashboard', {
        error: errorMessage,
        errorType: isNetworkError ? 'network' : isAuthError ? 'auth' : 'unknown'
      });

      throw error;
    }
  }, [userId, sessionToken, domains, transactions, loadDashboardData, t]);

  const refreshData = useCallback(async () => {
    await loadDashboardData({ useCache: false, showLoading: true });
  }, [loadDashboardData]);

  // Load data on mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return {
    domains,
    transactions,
    loading,
    error,
    dataSource,
    setError,
    loadDashboardData,
    saveData,
    refreshData
  };
}

