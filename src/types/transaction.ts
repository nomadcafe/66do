import { sellNetUSD } from '../lib/sellProceeds';

/** 分期到账明细。一行=一笔真实收到的款项；amount 可为负（退款 / 中断）。
 *  父交易必须是 type='sell' & payment_plan='installment'。 */
export interface InstallmentReceipt {
  id: string;
  transaction_id: string;
  received_date: string;
  amount: number;
  /** 用户填写的期号（"第几期"），仅供显示；不参与计算。 */
  period_no?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// 统一的Transaction接口定义
export interface Transaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'sell' | 'renew' | 'transfer' | 'fee' | 'marketing' | 'advertising';
  amount: number;
  currency: string;
  platform_fee?: number;
  platform_fee_percentage?: number;
  net_amount?: number;
  date: string;
  notes?: string;
  platform?: string;
  category?: string;
  tax_deductible?: boolean;
  receipt_url?: string;
  created_at: string;
  updated_at: string;
  user_id?: string; // 兼容旧版本
  
  // 分期付款相关字段
  payment_plan?: 'lump_sum' | 'installment';
  installment_period?: number;
  downpayment_amount?: number;
  installment_amount?: number;
  final_payment_amount?: number;
  total_installment_amount?: number;

  // 分期进度跟踪
  /** 真实到账明细（来自 installment_receipts 表）。一行=一笔到账，amount 可为
   *  负数表示退款。expandSellToCashReceipts / 计算层都按这个数组算，paid_periods
   *  字段已下线。dashboard 加载时挂上来；DB 不直接存。 */
  receipts?: InstallmentReceipt[];
  installment_status?: 'active' | 'completed' | 'cancelled' | 'paused';
  /** 首期付款日期（YYYY-MM-DD）。仅作为 UI 上"下一期默认日期"的种子；
   *  实际到账日全部走 installment_receipts.received_date。 */
  installment_first_payment_date?: string | null;
  platform_fee_type?: 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment';

  // 用户输入的费用率
  user_input_fee_rate?: number;
  user_input_surcharge_rate?: number;

  /** Afternic Installment 专用：卖家域名 nameserver 是否指向 Afternic
   *  指向 → 标准佣金 15% 起算；未指向 → 25% 起算。
   *  为 null/undefined 时按"指向"处理（向后兼容）。 */
  afternic_ns_pointed?: boolean | null;
  /** Afternic Installment 专用：是否开启 Premium add-on（+5% 标准佣金）。 */
  afternic_premium_addon?: boolean | null;

  /** Atom Installment 专用：卖家 listing tier，决定 base commission。
   *  null/undefined → 视为 'standard'（7.5%），向后兼容旧记录。 */
  atom_commission_tier?: 'standard' | 'plus' | 'premium' | 'byol' | 'custom' | null;
  /** Atom Premium 且 listPrice ≤ $4,998 时把 30% 顶到 35%；其它档位无效。 */
  atom_no_coin?: boolean | null;
  /** tier='custom' 时使用的佣金率（小数，如 0.0135 = 1.35%）。 */
  atom_custom_commission_rate?: number | null;

  /** Escrow Installment 专用：lease 类型，决定 monthly holding fee 公式。
   *  null/undefined → 视为 'lease_with_purchase'。 */
  escrow_lease_type?: 'lease_with_purchase' | 'lease_only' | null;
  /** Escrow Installment 专用：手填的标准交易费（含可选的 $250 schedule change /
   *  $85 DNS admin 等一次性费用）。 */
  escrow_transaction_fee?: number | null;

  /** renew：延长到期的年数（写入 domain_transactions.renewal_period_years） */
  renewal_period_years?: number | null;
  /** renew：仅当为 false 时不延长到期（旧数据/导入）；表单已移除该选项，保存 renew 默认始终延长 */
  extend_domain_expiry_on_renew?: boolean;
  /** renew：是否手填续费年数 */
  renewal_years_use_custom?: boolean;
}

// 扩展的Transaction接口，包含所有必需字段
export interface TransactionWithRequiredFields extends Transaction {
  domain_id: string;
  type: 'buy' | 'sell' | 'renew' | 'transfer' | 'fee' | 'marketing' | 'advertising';
  amount: number;
  currency: string;
  date: string;
  created_at: string;
  updated_at: string;
}

// Transaction创建时的输入类型（不包含id和自动生成的字段）
export interface CreateTransactionInput {
  domain_id: string;
  type: 'buy' | 'sell' | 'renew' | 'transfer' | 'fee' | 'marketing' | 'advertising';
  amount: number;
  currency: string;
  platform_fee?: number;
  platform_fee_percentage?: number;
  net_amount?: number;
  date: string;
  notes?: string;
  platform?: string;
  category?: string;
  tax_deductible?: boolean;
  receipt_url?: string;
  
  // 分期付款相关字段
  payment_plan?: 'lump_sum' | 'installment';
  installment_period?: number;
  downpayment_amount?: number;
  installment_amount?: number;
  final_payment_amount?: number;
  total_installment_amount?: number;
  
  // 分期进度跟踪
  installment_status?: 'active' | 'completed' | 'cancelled' | 'paused';
  installment_first_payment_date?: string | null;
  platform_fee_type?: 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment';

  // 用户输入的费用率
  user_input_fee_rate?: number;
  user_input_surcharge_rate?: number;

  // Afternic Installment 专用 commission flags
  afternic_ns_pointed?: boolean | null;
  afternic_premium_addon?: boolean | null;

  // Atom Installment 专用 commission tier
  atom_commission_tier?: 'standard' | 'plus' | 'premium' | 'byol' | 'custom' | null;
  atom_no_coin?: boolean | null;
  atom_custom_commission_rate?: number | null;

  // Escrow Installment 专用
  escrow_lease_type?: 'lease_with_purchase' | 'lease_only' | null;
  escrow_transaction_fee?: number | null;
}

// Transaction更新时的输入类型
export interface UpdateTransactionInput extends Partial<CreateTransactionInput> {
  id: string;
}

// 交易类型枚举
export enum TransactionType {
  BUY = 'buy',
  SELL = 'sell',
  RENEW = 'renew',
  TRANSFER = 'transfer',
  FEE = 'fee',
  MARKETING = 'marketing',
  ADVERTISING = 'advertising'
}

// 分期付款状态枚举
export enum InstallmentStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

// 平台费用类型枚举
export enum PlatformFeeType {
  STANDARD = 'standard',
  AFTERNIC_INSTALLMENT = 'afternic_installment',
  ATOM_INSTALLMENT = 'atom_installment',
  SPACESHIP_INSTALLMENT = 'spaceship_installment',
  ESCROW_INSTALLMENT = 'escrow_installment'
}

// 支付计划枚举
export enum PaymentPlan {
  LUMP_SUM = 'lump_sum',
  INSTALLMENT = 'installment'
}

// 交易统计接口
export interface TransactionStats {
  totalTransactions: number;
  totalAmount: number;
  averageAmount: number;
  byType: Record<string, number>;
  byMonth: Record<string, number>;
  byPlatform: Record<string, number>;
  byCategory: Record<string, number>;
}

// 交易查询接口
export interface TransactionQuery {
  domainId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  platform?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  installmentStatus?: InstallmentStatus;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'amount' | 'type' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

// 交易聚合接口
export interface TransactionAggregation {
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  minAmount: number;
  maxAmount: number;
  medianAmount: number;
  standardDeviation: number;
}

// 分期付款计划接口
export interface InstallmentSchedule {
  period: number;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paymentDate?: string;
  notes?: string;
}

// 交易验证结果接口
export interface TransactionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 交易类型验证器
export class TransactionValidator {
  static validate(transaction: CreateTransactionInput): TransactionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必需字段验证
    if (!transaction.domain_id) {
      errors.push('Domain ID is required');
    }
    if (!transaction.type) {
      errors.push('Transaction type is required');
    }
    if (transaction.amount === undefined || transaction.amount === null) {
      errors.push('Amount is required');
    }
    if (transaction.amount < 0) {
      errors.push('Amount must be positive');
    }
    if (!transaction.currency) {
      errors.push('Currency is required');
    }
    if (!transaction.date) {
      errors.push('Date is required');
    }

    // 分期付款验证
    if (transaction.payment_plan === 'installment') {
      if (!transaction.installment_period || transaction.installment_period < 1) {
        errors.push('Installment period must be at least 1');
      }
      if (transaction.downpayment_amount && transaction.downpayment_amount < 0) {
        errors.push('Downpayment amount must be positive');
      }
      if (transaction.installment_amount && transaction.installment_amount < 0) {
        errors.push('Installment amount must be positive');
      }
    }

    // 平台费用验证
    if (transaction.platform_fee && transaction.platform_fee < 0) {
      errors.push('Platform fee must be positive');
    }
    if (transaction.platform_fee_percentage && (transaction.platform_fee_percentage < 0 || transaction.platform_fee_percentage > 100)) {
      errors.push('Platform fee percentage must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// 交易工具函数
export class TransactionUtils {
  static calculateNetAmount(transaction: Transaction): number {
    return sellNetUSD(transaction);
  }

  static isInstallmentTransaction(transaction: Transaction): boolean {
    return transaction.payment_plan === 'installment';
  }

  static isCompletedInstallment(transaction: Transaction): boolean {
    if (transaction.installment_status === 'completed') return true;
    const totalPeriods = transaction.installment_period || 0;
    const paid = transaction.receipts?.length ?? 0;
    return totalPeriods > 0 && paid >= totalPeriods;
  }

  static getRemainingInstallments(transaction: Transaction): number {
    if (!this.isInstallmentTransaction(transaction)) {
      return 0;
    }
    const totalPeriods = transaction.installment_period || 0;
    const paidPeriods = transaction.receipts?.length ?? 0;
    return Math.max(0, totalPeriods - paidPeriods);
  }

  /** 返回 i18n 键，展示时请用 t(TransactionUtils.formatTransactionType(type)) */
  static formatTransactionType(type: string): string {
    const keyMap: Record<string, string> = {
      buy: 'transaction.buy',
      sell: 'transaction.sell',
      renew: 'transaction.renew',
      transfer: 'transaction.transfer',
      fee: 'transaction.fee',
      marketing: 'transaction.marketing',
      advertising: 'transaction.advertising'
    };
    return keyMap[type] || type;
  }

  /** 返回 i18n 键，展示时请用 t(TransactionUtils.formatInstallmentStatus(status)) */
  static formatInstallmentStatus(status: string): string {
    const keyMap: Record<string, string> = {
      active: 'transaction.active',
      completed: 'transaction.completed',
      cancelled: 'transaction.cancelled',
      paused: 'transaction.paused'
    };
    return keyMap[status] || status;
  }
}
