export interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  total_renewal_paid: number;
  next_renewal_date: string;
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  // Renewal cycle fields
  renewal_cycle_years: number;
  renewal_cycle_type: 'annual' | 'biennial' | 'triennial' | 'custom';
  last_renewal_amount: number;
  last_renewal_date: string;
  next_renewal_amount: number;
  renewal_count: number;
}

export interface DomainTransaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee';
  amount: number;
  currency: string;
  date: string;
  notes: string;
  platform?: string;
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
