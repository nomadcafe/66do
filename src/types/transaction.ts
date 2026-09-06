
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
  /** 分期期间的域名托管费总额。null = 未记录，按 escrow_lease_type + 标价 +
   *  期数自动估算；数字（含 0）= 用户明确记录的值，0 表示这笔没有托管费。
   *  null 和 0 必须区分：以前没有这个字段，自动估算永远生效且关不掉，
   *  会给交易凭空加上一笔谁都没付过的钱。 */
  escrow_holding_fee?: number | null;

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
export interface InstallmentSchedule {
  period: number;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paymentDate?: string;
  notes?: string;
}

// 交易验证结果接口
