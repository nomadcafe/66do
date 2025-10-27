import { Domain, Transaction } from '../lib/supabaseService';

// 扩展Domain类型，确保tags是数组
export interface DomainWithTags extends Omit<Domain, 'tags'> {
  tags: string[];
}

// 扩展Transaction类型，确保所有必需字段存在
export interface TransactionWithRequiredFields extends Transaction {
  domain_id: string;
  type: 'buy' | 'sell' | 'renew' | 'transfer' | 'fee' | 'marketing' | 'advertising';
  amount: number;
  date: string;
  // 分期付款相关字段
  payment_plan?: 'lump_sum' | 'installment';
  installment_period?: number;
  downpayment_amount?: number;
  installment_amount?: number;
  final_payment_amount?: number;
  total_installment_amount?: number;
  // 分期进度跟踪
  paid_periods?: number; // 已付期数
  installment_status?: 'active' | 'completed' | 'cancelled' | 'paused'; // 分期状态
  platform_fee_type?: 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment'; // 平台费用类型
}

// Dashboard组件props类型
export interface DomainListProps {
  domains: DomainWithTags[];
  onEdit: (domain: DomainWithTags) => void;
  onDelete: (id: string) => void;
  onView: (domain: DomainWithTags) => void;
  onAdd: () => void;
}

export interface TransactionListProps {
  transactions: TransactionWithRequiredFields[];
  domains: DomainWithTags[];
  onEdit: (transaction: TransactionWithRequiredFields) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export interface InvestmentAnalyticsProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

export interface FinancialReportProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

export interface FinancialAnalysisProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

export interface DomainFormProps {
  domain?: DomainWithTags;
  isOpen: boolean;
  onClose: () => void;
  onSave: (domain: Omit<DomainWithTags, 'id'>) => void;
}

export interface SmartDomainFormProps {
  domain?: DomainWithTags;
  isOpen: boolean;
  onClose: () => void;
  onSave: (domain: Omit<DomainWithTags, 'id'>) => void;
}

export interface TransactionFormProps {
  transaction?: TransactionWithRequiredFields;
  domains: DomainWithTags[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<TransactionWithRequiredFields, 'id'>) => void;
  onSaleComplete: (domain: DomainWithTags, transaction: TransactionWithRequiredFields) => void;
}

export interface AutoDomainMonitorProps {
  domains: DomainWithTags[];
  autoStart: boolean;
  showNotifications: boolean;
  onDomainExpiry: (expiryInfo: unknown) => void;
  onBulkExpiry: (expiryInfos: unknown[]) => void;
}

export interface DomainExpiryAlertProps {
  domains: DomainWithTags[];
  onRenewDomain: (domainId: string) => void;
}

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: unknown;
}

export interface SaleSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: DomainWithTags;
  transaction: TransactionWithRequiredFields;
}

// 类型转换工具函数
export function ensureDomainWithTags(domain: Domain | unknown): DomainWithTags {
  const d = domain as Domain;
  let tagsArray: string[] = [];
  
  if (Array.isArray(d.tags)) {
    tagsArray = d.tags;
  } else if (typeof d.tags === 'string' && d.tags.trim()) {
    try {
      tagsArray = JSON.parse(d.tags);
    } catch {
      tagsArray = d.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
  }
  
  return {
    ...d,
    tags: tagsArray
  };
}

export function ensureTransactionWithRequiredFields(transaction: Transaction | unknown): TransactionWithRequiredFields {
  const t = transaction as Transaction;
  return {
    ...t,
    domain_id: t.domain_id || '',
    type: (t.type || 'buy') as 'buy' | 'sell' | 'renew' | 'transfer' | 'fee',
    amount: t.amount || 0,
    date: t.date || new Date().toISOString()
  };
}
