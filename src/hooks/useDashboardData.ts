import { useState, useEffect, useCallback } from 'react';
import { domainCache } from '../lib/cache';
import { loadDomainsFromSupabase, loadTransactionsFromSupabase, TransactionService } from '../lib/supabaseService';
import { supabase } from '../lib/supabase';
import { buildTransactionInsertPayload } from '../lib/transactionInsertPayload';
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
  refreshToken: string | undefined,
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

      // 始终用浏览器端 Supabase 客户端拉取（带登录 session），RLS 正常；避免用 API 拉取时服务端 setSession 不可靠导致返回空
      logger.log('Loading data from Supabase database...');
      const [domainsResult, transactionsResult] = await Promise.all([
        loadDomainsFromSupabase(userId),
        loadTransactionsFromSupabase(userId),
      ]);
      if (!domainsResult.success || !transactionsResult.success) {
        throw new Error('Failed to load data from Supabase database');
      }
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

    // 先乐观更新，再校验与持久化：添加交易后立即更新列表和 Total Revenue / Total Sales 等
    if (!domainsOnly) {
      domainCache.invalidateUserCache(userId);
      setDomains(newDomains);
      setTransactions(newTransactions);
    }

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
      if (refreshToken) (headers as Record<string, string>)['X-Refresh-Token'] = refreshToken;

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
            body: JSON.stringify({ domain: domainPayload, refreshToken })
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

      // Save transactions: 更新走 API；新建用浏览器端 Supabase 插入（带 session，RLS 通过），避免 API 插入失败导致刷新后记录消失
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

        if (isExisting) {
          const response = await fetch(`/api/transactions/${transaction.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(transactionPayload)
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const details = errorData.details
              ? (Array.isArray(errorData.details) ? errorData.details.join('; ') : String(errorData.details))
              : (errorData.error || response.statusText);
            throw new Error(`Failed to update transaction: ${details}`);
          }
          savedTransactions.push(transaction);
        } else {
          const payload = buildTransactionInsertPayload(
            transactionPayload as Record<string, unknown>,
            userId
          );
          const { data: created, error: insertError } = await TransactionService.createTransactionWithClient(supabase, payload);
          if (insertError || !created) {
            throw new Error(insertError || 'Failed to add transaction');
          }
          savedTransactions.push(ensureTransactionWithRequiredFields(created));
        }
      }

      setTransactions(savedTransactions.length > 0 ? savedTransactions : newTransactions);

      // 不再在此处自动 re-fetch，避免 GET 因 RLS 返回空列表时覆盖当前状态；用户可手动刷新
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
        // 保存失败时不重新拉取，保留当前列表和乐观更新，用户可重试或刷新
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
  }, [userId, sessionToken, refreshToken, domains, transactions, loadDashboardData, t]);

  const refreshData = useCallback(async () => {
    await loadDashboardData({ useCache: false, showLoading: true });
  }, [loadDashboardData]);

  // Load data on mount; when sessionToken is present always bypass cache so we use API (same auth as save)
  useEffect(() => {
    if (!userId) return;
    loadDashboardData({ useCache: !sessionToken, showLoading: true });
  }, [loadDashboardData, userId, sessionToken]);

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

