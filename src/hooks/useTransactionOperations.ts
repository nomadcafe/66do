import { useState, useCallback } from 'react';
import { TransactionWithRequiredFields, ensureTransactionWithRequiredFields } from '../types/dashboard';
import { DomainWithTags } from '../types/dashboard';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { ERROR_MESSAGE_TIMEOUT } from '../lib/constants';
import { expiryExtensionYears } from '../lib/renewDomainPatch';

interface UseTransactionOperationsReturn {
  editingTransaction: TransactionWithRequiredFields | undefined;
  showTransactionForm: boolean;
  showSaleSuccessModal: boolean;
  saleSuccessData: { domain: DomainWithTags; transaction: TransactionWithRequiredFields } | null;
  setEditingTransaction: (transaction: TransactionWithRequiredFields | undefined) => void;
  setShowTransactionForm: (show: boolean) => void;
  setShowSaleSuccessModal: (show: boolean) => void;
  setSaleSuccessData: (data: { domain: DomainWithTags; transaction: TransactionWithRequiredFields } | null) => void;
  handleAddTransaction: () => void;
  handleEditTransaction: (transaction: TransactionWithRequiredFields) => void;
  handleDeleteTransaction: (id: string) => Promise<void>;
  handleSaveTransaction: (transactionData: Omit<TransactionWithRequiredFields, 'id'>) => Promise<void>;
  handleSaleComplete: (transaction: Omit<TransactionWithRequiredFields, 'id'>, domain: DomainWithTags) => void;
}

/** 删除一笔交易时应从 expiry_date 里扣回的年数。0 = 这笔交易当初没延长过到期。
 *  与 mergeRenewTransactionDomainUpdates 的 expiryExtensionYears 保持同一口径。 */
function rollbackExpiryYears(
  tx: TransactionWithRequiredFields,
  domains: DomainWithTags[]
): number {
  if (tx.extend_domain_expiry_on_renew === false) return 0;
  const cycle = domains.find((d) => d.id === tx.domain_id)?.renewal_cycle;
  return expiryExtensionYears(tx, cycle);
}

export function useTransactionOperations(
  transactions: TransactionWithRequiredFields[],
  domains: DomainWithTags[],
  userId: string | undefined,
  onSave: (domains: DomainWithTags[], transactions: TransactionWithRequiredFields[]) => Promise<void>,
  onDelete: (id: string) => Promise<void>,
  onError: (error: string) => void,
  sessionToken?: string | null
): UseTransactionOperationsReturn {
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithRequiredFields | undefined>();
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showSaleSuccessModal, setShowSaleSuccessModal] = useState(false);
  const [saleSuccessData, setSaleSuccessData] = useState<{ domain: DomainWithTags; transaction: TransactionWithRequiredFields } | null>(null);

  const handleAddTransaction = useCallback(() => {
    setEditingTransaction(undefined);
    setShowTransactionForm(false);
    setTimeout(() => {
      setShowTransactionForm(true);
    }, 0);
  }, []);

  const handleEditTransaction = useCallback((transaction: TransactionWithRequiredFields) => {
    setEditingTransaction(transaction);
    setShowTransactionForm(true);
  }, []);

  const handleDeleteTransaction = useCallback(async (id: string) => {
    if (!userId) return;

    try {
      const transactionToDelete = transactions.find(t => t.id === id);
      if (!transactionToDelete) return;

      const { data: { session: liveSession } } = await supabase.auth.getSession();
      const accessToken = liveSession?.access_token ?? sessionToken ?? null;
      const refreshTok = liveSession?.refresh_token ?? null;
      if (!accessToken) {
        throw new Error('Not authenticated');
      }
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      };
      if (refreshTok) {
        (headers as Record<string, string>)['X-Refresh-Token'] = refreshTok;
      }
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(
          response.status === 401
            ? 'Unauthorized'
            : `Failed to delete transaction${errText ? `: ${errText}` : ''}`
        );
      }

      const updatedTransactions = transactions.filter(transaction => transaction.id !== id);

      // Removing a sell tx may need to mutate the domain's sold-state.
      // If other sells remain for the same domain (e.g. installment / multiple sales),
      // resync to the latest remaining sell instead of wrongly reverting to active.
      if (transactionToDelete.type === 'sell' && transactionToDelete.domain_id) {
        const targetDomainId = transactionToDelete.domain_id;
        const remainingSells = updatedTransactions
          .filter(t => t.type === 'sell' && t.domain_id === targetDomainId)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const updatedDomains = domains.map(domain => {
          if (domain.id !== targetDomainId) return domain;
          if (remainingSells.length === 0) {
            return {
              ...domain,
              status: 'active' as const,
              sale_date: null,
              sale_price: null,
              platform_fee: null,
            };
          }
          const latest = remainingSells[0];
          return {
            ...domain,
            status: 'sold' as const,
            sale_date: latest.date ?? domain.sale_date,
            sale_price: latest.amount ?? domain.sale_price,
            platform_fee: latest.platform_fee ?? domain.platform_fee,
          };
        });

        await onSave(updatedDomains, updatedTransactions);
      } else if (
        rollbackExpiryYears(transactionToDelete, domains) > 0 &&
        transactionToDelete.domain_id
      ) {
        // 删除会延长到期的交易（renew，或填了年数的 transfer）要把当时加上去的
        // 年数撤回去——否则用户在 Domain Portfolio 里看到的依旧是被延长过的日期。
        // renew 还要把 renewal_count −1；transfer 当初就没 +1，这里也不减。
        const targetDomainId = transactionToDelete.domain_id;
        const yearsToRollback = rollbackExpiryYears(transactionToDelete, domains);
        const isRenew = transactionToDelete.type === 'renew';
        const updatedDomains = domains.map((domain) => {
          if (domain.id !== targetDomainId) return domain;
          let nextExpiry = domain.expiry_date ?? null;
          if (typeof nextExpiry === 'string' && nextExpiry) {
            const d = new Date(nextExpiry);
            if (!Number.isNaN(d.getTime())) {
              d.setFullYear(d.getFullYear() - yearsToRollback);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              nextExpiry = `${y}-${m}-${day}`;
            }
          }
          return {
            ...domain,
            expiry_date: nextExpiry,
            renewal_count: isRenew
              ? Math.max(0, (domain.renewal_count ?? 0) - 1)
              : domain.renewal_count,
            updated_at: new Date().toISOString(),
          };
        });
        await onSave(updatedDomains, updatedTransactions);
      } else {
        await onSave(domains, updatedTransactions);
      }

      logger.log('Transaction deleted successfully');
    } catch (error) {
      logger.error('Error deleting transaction:', error);
      onError(`Failed to delete transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [userId, sessionToken, transactions, domains, onSave, onError]);

  const handleSaveTransaction = useCallback(async (
    transactionData: Omit<TransactionWithRequiredFields, 'id'>
  ) => {

    let updatedTransactions: TransactionWithRequiredFields[];
    let updatedDomains = domains;

    try {
      if (editingTransaction) {
        // Update existing transaction
        const oldTransaction = editingTransaction;
        // 保留 receipts：表单不管 receipts，编辑后立即在内存里继续展示原有到账明细，
        // 不必等下一次 refreshData 才回填，避免 X/Y 进度短暂回落到 0/N。
        const newTransaction = ensureTransactionWithRequiredFields({
          ...transactionData,
          id: editingTransaction.id,
          receipts: editingTransaction.receipts,
        });

        updatedTransactions = transactions.map(transaction =>
          transaction.id === editingTransaction.id ? newTransaction : transaction
        );

        // 检查交易类型变化，准备域名状态更新
        if (oldTransaction.type === 'sell' && newTransaction.type !== 'sell' && oldTransaction.domain_id) {
          updatedDomains = domains.map(domain => {
            if (domain.id === oldTransaction.domain_id) {
              return {
                ...domain,
                status: 'active' as const,
                sale_date: null,
                sale_price: null,
                platform_fee: null
              };
            }
            return domain;
          });
        } else if (oldTransaction.type !== 'sell' && newTransaction.type === 'sell' && newTransaction.domain_id) {
          const isCancelledInstallment = newTransaction.payment_plan === 'installment' && newTransaction.installment_status === 'cancelled';
          updatedDomains = domains.map(domain => {
            if (domain.id !== newTransaction.domain_id) return domain;
            if (isCancelledInstallment) {
              return { ...domain, status: 'active' as const, sale_date: null, sale_price: null, platform_fee: null };
            }
            return {
              ...domain,
              status: 'sold' as const,
              sale_date: newTransaction.date,
              sale_price: newTransaction.amount,
              platform_fee: newTransaction.platform_fee || 0
            };
          });
        } else if (oldTransaction.type === 'sell' && newTransaction.type === 'sell' && oldTransaction.domain_id === newTransaction.domain_id) {
          const isCancelledInstallment = newTransaction.payment_plan === 'installment' && newTransaction.installment_status === 'cancelled';
          updatedDomains = domains.map(domain => {
            if (domain.id !== newTransaction.domain_id) return domain;
            if (isCancelledInstallment) {
              return { ...domain, status: 'active' as const, sale_date: null, sale_price: null, platform_fee: null };
            }
            return {
              ...domain,
              sale_date: newTransaction.date,
              sale_price: newTransaction.amount,
              platform_fee: newTransaction.platform_fee || 0
            };
          });
        }

        await onSave(updatedDomains, updatedTransactions);
      } else {
        // Add new transaction
        const newTransaction: TransactionWithRequiredFields = ensureTransactionWithRequiredFields({
          ...transactionData,
          id: crypto.randomUUID()
        });
        updatedTransactions = [...transactions, newTransaction];

        let domainUpdates: DomainWithTags[] = domains;
        if (newTransaction.type === 'sell' && newTransaction.domain_id) {
          const isCancelledInstallment = newTransaction.payment_plan === 'installment' && newTransaction.installment_status === 'cancelled';
          domainUpdates = domains.map(domain => {
            if (domain.id !== newTransaction.domain_id) return domain;
            if (isCancelledInstallment) {
              return { ...domain, status: 'active' as const, sale_date: null, sale_price: null, platform_fee: null };
            }
            return {
              ...domain,
              status: 'sold' as const,
              sale_date: newTransaction.date,
              sale_price: newTransaction.amount,
              platform_fee: newTransaction.platform_fee || 0
            };
          });
        }

        await onSave(domainUpdates, updatedTransactions);
      }

      setShowTransactionForm(false);
      setEditingTransaction(undefined);
      logger.log('Transaction saved successfully');
    } catch (error) {
      logger.error('Error saving transaction:', error);
      onError(`Failed to save transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => onError(''), ERROR_MESSAGE_TIMEOUT);
      throw error;
    }
  }, [editingTransaction, transactions, domains, onSave, onError]);

  const handleSaleComplete = useCallback((
    transaction: Omit<TransactionWithRequiredFields, 'id'>,
    domain: DomainWithTags
  ) => {
    const fullTransaction: TransactionWithRequiredFields = {
      ...transaction,
      id: crypto.randomUUID()
    };
    setSaleSuccessData({ domain, transaction: fullTransaction });
    setShowSaleSuccessModal(true);
  }, []);

  return {
    editingTransaction,
    showTransactionForm,
    showSaleSuccessModal,
    saleSuccessData,
    setEditingTransaction,
    setShowTransactionForm,
    setShowSaleSuccessModal,
    setSaleSuccessData,
    handleAddTransaction,
    handleEditTransaction,
    handleDeleteTransaction,
    handleSaveTransaction,
    handleSaleComplete
  };
}

