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

// 重新导出统一的Transaction类型
export type { Transaction as DomainTransaction } from './transaction';

export interface DomainStats {
  totalDomains: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  roi: number;
  expiringSoon: number;
  forSale: number;
}

// 重新导出统一的InstallmentSchedule类型
export type { InstallmentSchedule } from './transaction';
