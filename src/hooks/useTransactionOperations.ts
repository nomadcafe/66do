import { useState, useCallback } from 'react';
import { TransactionWithRequiredFields, ensureTransactionWithRequiredFields } from '../types/dashboard';
import { DomainWithTags } from '../types/dashboard';
import { logger } from '../lib/logger';
import { ERROR_MESSAGE_TIMEOUT } from '../lib/constants';

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

export function useTransactionOperations(
  transactions: TransactionWithRequiredFields[],
  domains: DomainWithTags[],
  userId: string | undefined,
  onSave: (domains: DomainWithTags[], transactions: TransactionWithRequiredFields[]) => Promise<void>,
  onDelete: (id: string) => Promise<void>,
  onError: (error: string) => void
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

      // Use RESTful DELETE /api/transactions/[id]
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to delete transaction');
      }

      const updatedTransactions = transactions.filter(transaction => transaction.id !== id);

      // 如果删除的是出售交易，需要将域名状态改回 active
      if (transactionToDelete.type === 'sell' && transactionToDelete.domain_id) {
        const updatedDomains = domains.map(domain => {
          if (domain.id === transactionToDelete.domain_id) {
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

        await onSave(updatedDomains, updatedTransactions);
      } else {
        await onSave(domains, updatedTransactions);
      }

      logger.log('Transaction deleted successfully');
    } catch (error) {
      logger.error('Error deleting transaction:', error);
      onError(`Failed to delete transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [userId, transactions, domains, onSave, onError]);

  const handleSaveTransaction = useCallback(async (
    transactionData: Omit<TransactionWithRequiredFields, 'id'>
  ) => {

    let updatedTransactions: TransactionWithRequiredFields[];
    let updatedDomains = domains;

    try {
      if (editingTransaction) {
        // Update existing transaction
        const oldTransaction = editingTransaction;
        const newTransaction = ensureTransactionWithRequiredFields({
          ...transactionData,
          id: editingTransaction.id
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

