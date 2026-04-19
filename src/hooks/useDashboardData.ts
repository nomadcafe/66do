import { useState, useEffect, useCallback } from 'react';
import { domainCache } from '../lib/cache';
import {
  loadDomainsFromSupabase,
  loadTransactionsFromSupabase,
  TransactionService,
  type TransactionUpdate,
} from '../lib/supabaseService';
import { supabase } from '../lib/supabase';
import { buildTransactionInsertPayload } from '../lib/transactionInsertPayload';
import {
  DomainWithTags,
  TransactionWithRequiredFields,
  ensureDomainWithTags,
  ensureTransactionWithRequiredFields
} from '../types/dashboard';
import { auditLogger } from '../lib/security';
import {
  translateValidationMessages,
  validateDomain,
  validateTransaction
} from '../lib/validation';
import { mergeRenewTransactionDomainUpdates } from '../lib/renewDomainPatch';
import { logger } from '../lib/logger';

interface LoadOptions {
  showLoading?: boolean;
}

/** 硬刷新后 Supabase 客户端可能尚未恢复 JWT，此时 RLS 会返回空列表，表现为「交易消失」 */
async function waitForSupabaseSession(
  userId: string,
  maxAttempts = 40,
  delayMs = 100
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id === userId) {
      // getSession() 可能读到本地缓存；getUser() 会向 Auth 校验 JWT，再查库更不容易空列表
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user?.id === userId) return true;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
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

    const { showLoading = true } = options;
    let loadSummary = {
      domainsCount: 0,
      transactionsCount: 0,
      dataSource: 'supabase' as const,
    };

    try {
      if (showLoading) setLoading(true);
      setError(null);

      const sessionReady = await waitForSupabaseSession(userId);
      if (!sessionReady) {
        logger.error('Dashboard load: Supabase session not ready for userId', userId);
        setError(t('common.authError') || 'Please sign in again to load your data.');
        if (showLoading) setLoading(false);
        return;
      }

      // 不再走内存 cache 捷径：曾导致刷新后仍展示旧列表或 session 未就绪时空列表被当作有效数据
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
    if (!userId) return;

    const domainsOnly = options?.domainsOnly === true;

    const domainsForSave = domainsOnly
      ? newDomains
      : mergeRenewTransactionDomainUpdates(newDomains, newTransactions, transactions);

    // 先乐观更新，再校验与持久化：新增/编辑后立即反映到 UI
    domainCache.invalidateUserCache(userId);
    setDomains(domainsForSave);
    if (!domainsOnly) setTransactions(newTransactions);

    try {
      // 优先用浏览器内 getSession()（可自动刷新过期的 access_token）；页面 props 里的 token 可能已过期
      const { data: { session: liveSession } } = await supabase.auth.getSession();
      const accessToken =
        liveSession?.access_token ?? sessionToken ?? null;
      const refreshTok =
        liveSession?.refresh_token ?? refreshToken ?? null;
      if (!accessToken) {
        setError(t('common.authError') || 'Please sign in again to save.');
        throw new Error('No access token for save');
      }

      const toDomainSignature = (domain: DomainWithTags) => JSON.stringify({
        id: domain.id,
        domain_name: domain.domain_name,
        status: domain.status,
        renewal_cycle: domain.renewal_cycle ?? 1,
        renewal_count: domain.renewal_count ?? 0,
        registrar: domain.registrar || null,
        purchase_date: domain.purchase_date || null,
        purchase_cost: domain.purchase_cost || null,
        renewal_cost: domain.renewal_cost || null,
        baseline_renewal_as_of: domain.baseline_renewal_as_of || null,
        next_renewal_date: domain.next_renewal_date || null,
        expiry_date: domain.expiry_date || null,
        estimated_value: domain.estimated_value || null,
        sale_date: domain.sale_date || null,
        sale_price: domain.sale_price || null,
        platform_fee: domain.platform_fee || null,
        tags: JSON.stringify(domain.tags || []),
      });
      const toTransactionSignature = (transaction: TransactionWithRequiredFields) => JSON.stringify({
        id: transaction.id,
        domain_id: transaction.domain_id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        exchange_rate: transaction.exchange_rate || null,
        base_amount: transaction.base_amount || null,
        platform_fee: transaction.platform_fee || null,
        platform_fee_percentage: transaction.platform_fee_percentage || null,
        net_amount: transaction.net_amount || null,
        date: transaction.date,
        notes: transaction.notes || null,
        platform: transaction.platform || null,
        category: transaction.category || null,
        tax_deductible: transaction.tax_deductible ?? false,
        receipt_url: transaction.receipt_url || null,
        payment_plan: transaction.payment_plan || null,
        installment_period: transaction.installment_period || null,
        downpayment_amount: transaction.downpayment_amount || null,
        installment_amount: transaction.installment_amount || null,
        final_payment_amount: transaction.final_payment_amount || null,
        total_installment_amount: transaction.total_installment_amount || null,
        paid_periods: transaction.paid_periods || null,
        installment_status: transaction.installment_status || null,
        platform_fee_type: transaction.platform_fee_type || null,
        user_input_fee_rate: transaction.user_input_fee_rate || null,
        user_input_surcharge_rate: transaction.user_input_surcharge_rate || null,
        renewal_period_years: transaction.renewal_period_years ?? null,
        extend_domain_expiry_on_renew: transaction.extend_domain_expiry_on_renew ?? null,
        renewal_years_use_custom: transaction.renewal_years_use_custom ?? null,
      });

      const existingDomainMap = new Map(domains.map((d) => [d.id, d]));
      const changedDomains = domainsForSave.filter((domain) => {
        const existing = existingDomainMap.get(domain.id);
        if (!existing) return true;
        return toDomainSignature(existing) !== toDomainSignature(domain);
      });

      const existingTransactionMap = new Map(transactions.map((tx) => [tx.id, tx]));
      const changedTransactions = domainsOnly
        ? []
        : newTransactions.filter((transaction) => {
            const existing = existingTransactionMap.get(transaction.id);
            if (!existing) return true;
            return toTransactionSignature(existing) !== toTransactionSignature(transaction);
          });

      logger.log(
        domainsOnly
          ? `Saving changed domains to Supabase... (${changedDomains.length})`
          : `Saving changed data to Supabase... (${changedDomains.length} domains, ${changedTransactions.length} transactions)`
      );

      for (const domain of changedDomains) {
        const validation = validateDomain(domain);
        if (!validation.valid) {
          const msgs = translateValidationMessages(validation.errors, t);
          throw new Error(`Domain validation failed: ${msgs.join(', ')}`);
        }
      }

      if (!domainsOnly) {
        for (const transaction of changedTransactions) {
          const validation = validateTransaction(transaction);
          if (!validation.valid) {
            const msgs = translateValidationMessages(validation.errors, t);
            throw new Error(`Transaction validation failed: ${msgs.join(', ')}`);
          }
        }
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      };
      if (refreshTok) (headers as Record<string, string>)['X-Refresh-Token'] = refreshTok;

      // 增量保存 domains（仅新增/变更）
      for (const domain of changedDomains) {
        const isExisting = domains.find(d => d.id === domain.id);
        const domainPayload = {
          ...domain,
          id: domain.id,
          domain_name: domain.domain_name,
          status: domain.status,
          renewal_cycle: domain.renewal_cycle ?? 1,
          renewal_count: domain.renewal_count ?? 0,
          registrar: domain.registrar || null,
          purchase_date: domain.purchase_date || null,
          purchase_cost: domain.purchase_cost || null,
          renewal_cost: domain.renewal_cost || null,
          baseline_renewal_as_of: domain.baseline_renewal_as_of || null,
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
            body: JSON.stringify({ domain: domainPayload, refreshToken: refreshTok })
          });
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const details = errorData.details
            ? (Array.isArray(errorData.details)
                ? translateValidationMessages(errorData.details, t).join('; ')
                : String(errorData.details))
            : (errorData.error || response.statusText);
          throw new Error(`Failed to ${isExisting ? 'update' : 'add'} domain: ${details}`);
        }
      }

      if (domainsOnly) {
        logger.log('Domains saved successfully');
        return;
      }

      // 增量保存 transactions（仅新增/变更）
      const serverTransactionsById = new Map<string, TransactionWithRequiredFields>();
      for (const transaction of changedTransactions) {
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
            // 交易在本地存在但远端缺失（例如历史保存中断）时，回退为创建，避免持续 404/403 卡死。
            if (response.status === 404 || response.status === 403) {
              const payload = buildTransactionInsertPayload(
                transactionPayload as Record<string, unknown>,
                userId
              );
              const { data: created, error: insertError } =
                await TransactionService.createTransactionWithClient(supabase, payload);
              if (!insertError && created) {
                const ensured = ensureTransactionWithRequiredFields(created);
                serverTransactionsById.set(ensured.id, ensured);
                continue;
              }
              const msg = insertError || '';
              const isDuplicatePkey =
                msg.includes('duplicate key') ||
                msg.includes('domain_transactions_pkey') ||
                msg.includes('23505');
              if (isDuplicatePkey) {
                const { id: txId, user_id: _uid, ...updates } = payload;
                const updated = await TransactionService.updateTransactionWithClient(
                  supabase,
                  txId,
                  updates as TransactionUpdate,
                  userId
                );
                if (!updated) {
                  throw new Error(insertError || 'Failed to update existing transaction after duplicate key');
                }
                const ensured = ensureTransactionWithRequiredFields(updated);
                serverTransactionsById.set(ensured.id, ensured);
                continue;
              }
              throw new Error(insertError || 'Failed to add transaction');
            }
            const errorData = await response.json().catch(() => ({}));
            const details = errorData.details
              ? (Array.isArray(errorData.details)
                  ? translateValidationMessages(errorData.details, t).join('; ')
                  : String(errorData.details))
              : (errorData.error || response.statusText);
            throw new Error(`Failed to update transaction: ${details}`);
          }
        } else {
          const payload = buildTransactionInsertPayload(
            transactionPayload as Record<string, unknown>,
            userId
          );
          const { data: created, error: insertError } = await TransactionService.createTransactionWithClient(supabase, payload);
          if (insertError || !created) {
            throw new Error(insertError || 'Failed to add transaction');
          }
          const ensured = ensureTransactionWithRequiredFields(created);
          serverTransactionsById.set(ensured.id, ensured);
        }
      }

      if (serverTransactionsById.size > 0) {
        setTransactions(
          newTransactions.map((t) => serverTransactionsById.get(t.id) ?? t)
        );
      }

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
  }, [userId, sessionToken, refreshToken, domains, transactions, t]);

  const refreshData = useCallback(async () => {
    await loadDashboardData({ showLoading: true });
  }, [loadDashboardData]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setDomains([]);
      setTransactions([]);
      return;
    }
    loadDashboardData({ showLoading: true });
  }, [loadDashboardData, userId]);

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

