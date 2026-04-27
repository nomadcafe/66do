export interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number; // 续费周期（年数）：1, 2, 3等
  renewal_count: number; // 已续费次数
  /** 续费成本基线日：此前历史用 renewal_count×renewal_cost；之后叠加 renew 交易 */
  baseline_renewal_as_of?: string | null;
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

// 重新导出统一的InstallmentSchedule类型
export type { InstallmentSchedule } from './transaction';
