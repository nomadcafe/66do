// TypeScript types for Cloudflare D1 Database
export interface Env {
  DB: any; // D1Database type will be available at runtime
  KV?: any; // KVNamespace type will be available at runtime
}

export interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number; // 续费周期（年数）：1, 2, 3等
  next_renewal_date?: string;
  expiry_date: string;
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  tags: string[];
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DomainTransaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee';
  amount: number;
  currency: string;
  date: string;
  notes: string;
  platform: string;
  transaction_time: string;
  gross_amount: number;
  fee_percentage: number;
  fee_amount: number;
  payment_plan: 'lump_sum' | 'installment';
  installment_period: number;
  installment_fee_percentage: number;
  installment_fee_amount: number;
  monthly_payment: number;
  total_installment_amount: number;
  payment_status: 'completed' | 'in_progress' | 'overdue';
  paid_installments: number;
  remaining_installments: number;
  created_at: string;
}

export interface DomainAlert {
  id: string;
  domain_id: string;
  alert_type: 'renewal' | 'price' | 'expiry';
  trigger_days_before: number;
  enabled: boolean;
  last_triggered: string;
  created_at: string;
}

export interface DomainSettings {
  id: string;
  user_id: string;
  default_currency: string;
  default_registrar: string;
  alert_preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}
