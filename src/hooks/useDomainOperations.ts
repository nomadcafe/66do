import { useState, useCallback } from 'react';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import type { RenewalSubmission } from '../components/domain/RenewalModal';

interface UseDomainOperationsReturn {
  editingDomain: DomainWithTags | undefined;
  showDomainForm: boolean;
  showSmartDomainForm: boolean;
  showRenewalModal: boolean;
  renewalDomain: DomainWithTags | null;
  setEditingDomain: (domain: DomainWithTags | undefined) => void;
  setShowDomainForm: (show: boolean) => void;
  setShowSmartDomainForm: (show: boolean) => void;
  setShowRenewalModal: (show: boolean) => void;
  setRenewalDomain: (domain: DomainWithTags | null) => void;
  handleAddDomain: () => void;
  handleEditDomain: (domain: DomainWithTags) => void;
  handleRenewDomain: (domain: DomainWithTags) => void;
  handleDeleteDomain: (id: string) => Promise<void>;
  processRenewal: (domain: DomainWithTags, input: RenewalSubmission) => Promise<{
    updatedDomain: DomainWithTags;
    newTransaction: TransactionWithRequiredFields;
  }>;
}

export function useDomainOperations(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[],
  onSave: (domains: DomainWithTags[], transactions: TransactionWithRequiredFields[]) => Promise<void>,
  onDelete: (id: string) => Promise<void>
): UseDomainOperationsReturn {
  const [editingDomain, setEditingDomain] = useState<DomainWithTags | undefined>();
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [showSmartDomainForm, setShowSmartDomainForm] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalDomain, setRenewalDomain] = useState<DomainWithTags | null>(null);

  const handleAddDomain = useCallback(() => {
    setEditingDomain(undefined);
    setShowDomainForm(true);
  }, []);

  const handleEditDomain = useCallback((domain: DomainWithTags) => {
    setEditingDomain(domain);
    setShowDomainForm(true);
  }, []);

  const handleRenewDomain = useCallback((domain: DomainWithTags) => {
    setRenewalDomain(domain);
    setShowRenewalModal(true);
  }, []);

  const handleDeleteDomain = useCallback(async (id: string) => {
    await onDelete(id);
  }, [onDelete]);

  const processRenewal = useCallback(async (
    domain: DomainWithTags,
    input: RenewalSubmission
  ): Promise<{ updatedDomain: DomainWithTags; newTransaction: TransactionWithRequiredFields }> => {
    const renewalYears = input.renewalYears;
    // 到期日 / renewal_count 由 saveData 内 mergeRenewTransactionDomainUpdates 与续费交易统一处理，避免此处与 merge 各算一次导致双延长。
    const renewedDomain: DomainWithTags = {
      ...domain,
      registrar: input.registrar || domain.registrar,
      renewal_cost: input.updateRenewalCost ? (input.amount / renewalYears) : domain.renewal_cost,
      updated_at: new Date().toISOString()
    };

    // 创建续费交易记录
    const renewalCost = input.amount;
    const renewalTransaction: TransactionWithRequiredFields = {
      id: crypto.randomUUID(),
      domain_id: domain.id,
      type: 'renew' as const,
      renewal_period_years: renewalYears,
      amount: renewalCost,
      currency: 'USD',
      exchange_rate: 1,
      base_amount: renewalCost,
      platform_fee: undefined,
      platform_fee_percentage: undefined,
      net_amount: renewalCost,
      category: 'renewal',
      tax_deductible: false,
      receipt_url: undefined,
      notes: input.notes || `Renewed for ${renewalYears} year(s)`,
      date: input.date,
      platform: input.registrar || domain.registrar || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let transferTransaction: TransactionWithRequiredFields | null = null;
    if (input.createTransferTransaction && input.registrar) {
      const baseNotes = `Registrar transfer: ${domain.registrar || 'Unknown'} -> ${input.registrar}`;
      transferTransaction = {
        id: crypto.randomUUID(),
        domain_id: domain.id,
        type: 'transfer',
        amount: input.transferFee || 0,
        currency: 'USD',
        exchange_rate: 1,
        base_amount: input.transferFee || 0,
        platform_fee: undefined,
        platform_fee_percentage: undefined,
        net_amount: input.transferFee || 0,
        category: 'transfer',
        tax_deductible: false,
        receipt_url: undefined,
        notes: input.notes ? `${baseNotes}; ${input.notes}` : baseNotes,
        date: input.date,
        platform: input.registrar,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    // 更新域名列表
    const updatedDomains = domains.map(d =>
      d.id === domain.id ? renewedDomain : d
    );

    // 保存数据（追加新交易，不覆盖现有交易）
    const nextTransactions = transferTransaction
      ? [...transactions, renewalTransaction, transferTransaction]
      : [...transactions, renewalTransaction];
    await onSave(updatedDomains, nextTransactions);

    return {
      updatedDomain: renewedDomain,
      newTransaction: renewalTransaction as TransactionWithRequiredFields
    };
  }, [domains, transactions, onSave]);

  return {
    editingDomain,
    showDomainForm,
    showSmartDomainForm,
    showRenewalModal,
    renewalDomain,
    setEditingDomain,
    setShowDomainForm,
    setShowSmartDomainForm,
    setShowRenewalModal,
    setRenewalDomain,
    handleAddDomain,
    handleEditDomain,
    handleRenewDomain,
    handleDeleteDomain,
    processRenewal
  };
}

