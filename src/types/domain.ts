export interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number; // 续费周期（年数）：1, 2, 3等
  renewal_count: number; // 已续费次数
  next_renewal_date?: string;
  expiry_date?: string; // 改为可选字段
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  sale_date?: string; // 出售日期
  sale_price?: number; // 出售价格
  platform_fee?: number; // 平台手续费
  tags: string[];
  created_at?: string;
  updated_at?: string;
}

export interface DomainTransaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising' | 'installment_payment' | 'installment_refund';
  amount: number;
  currency: string;
  exchange_rate?: number; // 汇率
  base_amount?: number; // 基础货币金额
  platform_fee?: number; // 平台手续费
  platform_fee_percentage?: number; // 手续费百分比
  net_amount?: number; // 净收入
  date: string;
  notes: string;
  platform?: string;
  category?: string; // 交易分类
  tax_deductible?: boolean; // 是否可抵税
  receipt_url?: string; // 收据链接
  transaction_time?: string;
  gross_amount?: number;
  fee_percentage?: number;
  fee_amount?: number;
  payment_plan?: 'lump_sum' | 'installment';
  installment_period?: number;
  installment_fee_percentage?: number;
  installment_fee_amount?: number;
  monthly_payment?: number;
  total_installment_amount?: number;
  payment_status?: 'completed' | 'in_progress' | 'overdue';
  paid_installments?: number;
  remaining_installments?: number;
}

export interface DomainStats {
  totalDomains: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  roi: number;
  expiringSoon: number;
  forSale: number;
}
