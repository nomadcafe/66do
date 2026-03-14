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
  saveData: (newDomains: DomainWithTags[], newTransactions: TransactionWithRequiredFields[], options?: { domainsOnly?: boolean }) => Promise<void>;
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
    newTransactions: TransactionWithRequiredFields[],
    options?: { domainsOnly?: boolean }
  ) => {
    if (!userId || !sessionToken) return;

    const domainsOnly = options?.domainsOnly === true;

    try {
      logger.log(domainsOnly ? 'Saving domains to Supabase...' : 'Saving data to Supabase database...');

      for (const domain of newDomains) {
        const validation = validateDomain(domain);
        if (!validation.valid) {
          throw new Error(`Domain validation failed: ${validation.errors.join(', ')}`);
        }
      }

      if (!domainsOnly) {
        for (const transaction of newTransactions) {
          const validation = validateTransaction(transaction);
          if (!validation.valid) {
            throw new Error(`Transaction validation failed: ${validation.errors.join(', ')}`);
          }
        }
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      };

      // 保存交易时先乐观更新，再持久化，避免表单长时间等待（域名多时 domain 循环很慢）
      if (!domainsOnly) {
        domainCache.invalidateUserCache(userId);
        setDomains(newDomains);
        setTransactions(newTransactions);
      }

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
          const errorData = await response.json().catch(() => ({}));
          const details = errorData.details
            ? (Array.isArray(errorData.details) ? errorData.details.join('; ') : String(errorData.details))
            : (errorData.error || response.statusText);
          throw new Error(`Failed to ${isExisting ? 'update' : 'add'} domain: ${details}`);
        }
      }

      if (domainsOnly) {
        domainCache.invalidateUserCache(userId);
        setDomains(newDomains);
        await loadDashboardData({ useCache: false, showLoading: false });
        logger.log('Domains saved successfully');
        return;
      }

      // Save transactions to Supabase；收集保存后的列表（新建用服务端返回的 id）
      const savedTransactions: TransactionWithRequiredFields[] = [];
      for (const transaction of newTransactions) {
        const isExisting = transactions.find(t => t.id === transaction.id);
        const transactionPayload = {
          ...transaction,
          base_amount: transaction.base_amount || null,
          platform_fee: transaction.platform_fee || null,
          platform_fee_percentage: transaction.platform_fee_percentage || null,
          net_amount: transaction.net_amount || null,
          category: transaction.category || null,
          tax_deductible: transaction.tax_deductible ?? false,
          receipt_url: transaction.receipt_url || null,
          notes: transaction.notes || null
        };

        let response: Response;
        let didRetryPost = false;
        if (isExisting) {
          response = await fetch(`/api/transactions/${transaction.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(transactionPayload)
          });
          if (response.status === 403) {
            const errBody = await response.json().catch(() => ({}));
            const msg = (errBody?.error || '').toLowerCase();
            if (msg.includes('not found') || msg.includes('access denied')) {
              response = await fetch('/api/transactions', {
                method: 'POST',
                headers,
                body: JSON.stringify({ transaction: transactionPayload })
              });
              didRetryPost = response.ok;
            }
          }
        } else {
          response = await fetch('/api/transactions', {
            method: 'POST',
            headers,
            body: JSON.stringify({ transaction: transactionPayload })
          });
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const details = errorData.details
            ? (Array.isArray(errorData.details) ? errorData.details.join('; ') : String(errorData.details))
            : (errorData.error || response.statusText);
          throw new Error(`Failed to ${isExisting ? 'update' : 'add'} transaction: ${details}`);
        }

        if (!isExisting || didRetryPost) {
          const json = await response.json().catch(() => ({}));
          const created = json?.data;
          if (created && typeof created === 'object') {
            savedTransactions.push(ensureTransactionWithRequiredFields(created));
          } else {
            savedTransactions.push(transaction);
          }
        } else {
          savedTransactions.push(transaction);
        }
      }

      setTransactions(savedTransactions.length > 0 ? savedTransactions : newTransactions);

      logger.log('Data saved to Supabase database successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isDuplicateDomain =
        errorMessage.includes('already in your portfolio') ||
        errorMessage.includes('Domain already exists') ||
        errorMessage.includes('域名已在');

      if (isDuplicateDomain) {
        logger.log('Add domain skipped: domain already in portfolio');
      } else {
        logger.error('Error saving data to Supabase:', error);
      }

      if (userId) {
        domainCache.invalidateUserCache(userId);
        await loadDashboardData({ useCache: false, showLoading: false });
      }

      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network');
      const isAuthError = errorMessage.includes('401') || errorMessage.includes('Unauthorized');

      if (isAuthError) {
        setError(t('common.authError') || 'Authentication failed. Please log in again.');
      } else if (isNetworkError) {
        setError(t('common.networkError') || 'Network error. Please check your connection and try again.');
      } else if (isDuplicateDomain) {
        setError(t('dashboard.domainAlreadyExistsDesc') || t('dashboard.domainAlreadyExists') || errorMessage);
      } else {
        setError(t('common.dataSaveFailed') || `Failed to save data: ${errorMessage}`);
      }

      if (!isDuplicateDomain) {
        auditLogger.log(userId || 'unknown', 'data_save_failed', 'dashboard', {
          error: errorMessage,
          errorType: isNetworkError ? 'network' : isAuthError ? 'auth' : 'unknown'
        });
      }

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

