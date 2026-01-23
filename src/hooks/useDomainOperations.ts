import { useState, useCallback } from 'react';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import { DomainExpiryManager } from '../lib/domainExpiryManager';
import { Domain } from '../types/domain';

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
  processRenewal: (domain: DomainWithTags, renewalYears: number) => Promise<{
    updatedDomain: DomainWithTags;
    newTransaction: TransactionWithRequiredFields;
  }>;
}

export function useDomainOperations(
  domains: DomainWithTags[],
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
    renewalYears: number
  ): Promise<{ updatedDomain: DomainWithTags; newTransaction: TransactionWithRequiredFields }> => {
    // 将DomainWithTags转换为Domain类型（来自types/domain.ts）以使用DomainExpiryManager
    const domainForRenewal: Domain = {
      id: domain.id,
      domain_name: domain.domain_name,
      registrar: domain.registrar ?? '',
      purchase_date: domain.purchase_date ?? '',
      purchase_cost: domain.purchase_cost ?? 0,
      renewal_cost: domain.renewal_cost ?? 0,
      renewal_cycle: domain.renewal_cycle ?? 1,
      renewal_count: domain.renewal_count ?? 0,
      expiry_date: domain.expiry_date ?? undefined,
      status: domain.status as 'active' | 'for_sale' | 'sold' | 'expired',
      estimated_value: domain.estimated_value ?? 0,
      sale_date: domain.sale_date ?? undefined,
      sale_price: domain.sale_price ?? undefined,
      platform_fee: domain.platform_fee ?? undefined,
      tags: Array.isArray(domain.tags) ? domain.tags : (domain.tags ? [domain.tags] : []),
      created_at: domain.created_at ?? undefined,
      updated_at: domain.updated_at ?? undefined
    };

    // 使用DomainExpiryManager处理续费
    const expiryManager = new DomainExpiryManager();
    const renewedDomainResult = expiryManager.handleDomainRenewal(
      domainForRenewal,
      renewalYears
    );

    // 更新域名数据
    const renewedDomain: DomainWithTags = {
      ...domain,
      renewal_count: renewedDomainResult.renewal_count,
      expiry_date: renewedDomainResult.expiry_date ?? null,
      next_renewal_date: renewedDomainResult.next_renewal_date ?? null,
      updated_at: new Date().toISOString()
    };

    // 创建续费交易记录
    const renewalCost = (domain.renewal_cost || 0) * renewalYears;
    const renewalTransaction: TransactionWithRequiredFields = {
      id: crypto.randomUUID(),
      domain_id: domain.id,
      type: 'renew' as const,
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
      notes: `Renewed for ${renewalYears} year(s)`,
      date: new Date().toISOString().split('T')[0],
      platform: domain.registrar || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 更新域名列表
    const updatedDomains = domains.map(d =>
      d.id === domain.id ? renewedDomain : d
    );

    // 保存数据
    await onSave(updatedDomains, [renewalTransaction]);

    return {
      updatedDomain: renewedDomain,
      newTransaction: renewalTransaction as TransactionWithRequiredFields
    };
  }, [domains, onSave]);

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

