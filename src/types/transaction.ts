// 统一的Transaction接口定义
export interface Transaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'sell' | 'renew' | 'transfer' | 'fee' | 'marketing' | 'advertising';
  amount: number;
  currency: string;
  exchange_rate?: number;
  base_amount?: number;
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
  paid_periods?: number;
  installment_status?: 'active' | 'completed' | 'cancelled' | 'paused';
  platform_fee_type?: 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment';
  
  // 用户输入的费用率
  user_input_fee_rate?: number;
  user_input_surcharge_rate?: number;
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
  exchange_rate?: number;
  base_amount?: number;
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
  paid_periods?: number;
  installment_status?: 'active' | 'completed' | 'cancelled' | 'paused';
  platform_fee_type?: 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment';
  
  // 用户输入的费用率
  user_input_fee_rate?: number;
  user_input_surcharge_rate?: number;
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
    if (transaction.net_amount !== undefined) {
      return transaction.net_amount;
    }
    return transaction.amount - (transaction.platform_fee || 0);
  }

  static isInstallmentTransaction(transaction: Transaction): boolean {
    return transaction.payment_plan === 'installment';
  }

  static isCompletedInstallment(transaction: Transaction): boolean {
    return transaction.installment_status === 'completed';
  }

  static getRemainingInstallments(transaction: Transaction): number {
    if (!this.isInstallmentTransaction(transaction)) {
      return 0;
    }
    const totalPeriods = transaction.installment_period || 0;
    const paidPeriods = transaction.paid_periods || 0;
    return Math.max(0, totalPeriods - paidPeriods);
  }

  static formatTransactionType(type: string): string {
    const typeMap: Record<string, string> = {
      'buy': '购买',
      'sell': '出售',
      'renew': '续费',
      'transfer': '转移',
      'fee': '费用',
      'marketing': '营销',
      'advertising': '广告'
    };
    return typeMap[type] || type;
  }

  static formatInstallmentStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'active': '进行中',
      'completed': '已完成',
      'cancelled': '已取消',
      'paused': '已暂停'
    };
    return statusMap[status] || status;
  }
}
