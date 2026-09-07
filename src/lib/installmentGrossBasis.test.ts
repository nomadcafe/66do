import { describe, it, expect } from 'vitest';
import { expandSellToCashReceipts } from './coreCalculations';
import {
  installmentFeeFromFormValues,
  sellerSidePlatformFee,
  type InstallmentFeeFormValues,
} from './platformFeeCalculator';
import type { TransactionWithRequiredFields } from '../types/transaction';

/**
 * 端到端守卫：表单口径 → 存库 → 现金流管线，三段必须闭合。
 *
 * 不变式：Σ(收据 × (1 − feeRate)) === 卖家净收入 === amount − platform_fee。
 * 这条链断过一次——表单按卖家净额自动填每期金额，管线又把收据当毛额再扣一遍
 * 佣金，标价 $10,000 / 15% 的 Afternic 分期算出 $7,225 而不是 $8,500。
 */
function formValues(over: Partial<InstallmentFeeFormValues> = {}): InstallmentFeeFormValues {
  return {
    amount: 10000,
    platformFeePercentage: 0,
    installment_amount: 0,
    installment_period: 10,
    platform_fee_type: 'afternic_installment',
    downpayment_amount: 0,
    final_payment_amount: 0,
    user_input_fee_rate: 0,
    user_input_surcharge_rate: 0,
    afternic_ns_pointed: true,
    afternic_premium_addon: false,
    atom_commission_tier: 'standard',
    atom_no_coin: false,
    atom_custom_commission_rate: 0,
    escrow_lease_type: 'lease_with_purchase',
    escrow_holding_fee: null,
    escrow_transaction_fee: 0,
    ...over,
  };
}

/** 复刻 TransactionForm 的每期金额 effect：amount 的纯拆分，不预扣佣金 */
function autoInstallmentAmount(v: InstallmentFeeFormValues): number {
  const regular = v.installment_period - (v.final_payment_amount > 0 ? 1 : 0);
  if (regular <= 0) return 0;
  return (v.amount - v.downpayment_amount - v.final_payment_amount) / regular;
}

function buildTx(v: InstallmentFeeFormValues, fee: number): TransactionWithRequiredFields {
  const regular = v.installment_period - (v.final_payment_amount > 0 ? 1 : 0);
  const receipts = Array.from({ length: regular }, (_, i) => ({
    id: `r${i}`,
    amount: v.installment_amount,
    received_date: `2026-${String((i % 12) + 1).padStart(2, '0')}-15`,
  }));
  if (v.final_payment_amount > 0) {
    receipts.push({ id: 'rf', amount: v.final_payment_amount, received_date: '2027-01-15' });
  }
  return {
    id: 't1',
    domain_id: 'd1',
    type: 'sell',
    date: '2026-01-15',
    currency: 'USD',
    amount: v.amount,
    platform_fee: fee,
    net_amount: v.amount - fee,
    payment_plan: 'installment',
    downpayment_amount: v.downpayment_amount,
    receipts,
    created_at: '',
    updated_at: '',
  } as unknown as TransactionWithRequiredFields;
}

function roundTrip(over: Partial<InstallmentFeeFormValues> = {}) {
  const base = formValues(over);
  const v = { ...base, installment_amount: autoInstallmentAmount(base) };
  const result = installmentFeeFromFormValues(v);
  const fee = sellerSidePlatformFee(v.amount, result) ?? 0;
  const events = expandSellToCashReceipts(buildTx(v, fee));
  return {
    v,
    fee,
    sellerNet: v.amount - fee,
    pipelineNet: events.reduce((s, e) => s + e.netAmount, 0),
  };
}

describe('分期口径闭环：收据合计 → 管线净额 === 卖家净收入', () => {
  it('Afternic 10 期无首付（曾经算出 7225 而不是 8500）', () => {
    const r = roundTrip();
    expect(r.v.installment_amount).toBeCloseTo(1000, 6); // 毛额拆分，不是 850
    expect(r.fee).toBeCloseTo(1500, 6);
    expect(r.sellerNet).toBeCloseTo(8500, 6);
    expect(r.pipelineNet).toBeCloseTo(8500, 6);
  });

  it('Afternic 带首付和尾款', () => {
    const r = roundTrip({ downpayment_amount: 2000, final_payment_amount: 1000 });
    expect(r.pipelineNet).toBeCloseTo(r.sellerNet, 6);
  });

  it('Afternic 24 期（有买家服务费，不该算进卖家扣减）', () => {
    const r = roundTrip({ installment_period: 24 });
    expect(r.pipelineNet).toBeCloseTo(r.sellerNet, 6);
  });

  it('Spaceship 分期', () => {
    const r = roundTrip({ platform_fee_type: 'spaceship_installment' });
    expect(r.fee).toBeCloseTo(1000, 6); // 10%
    expect(r.pipelineNet).toBeCloseTo(r.sellerNet, 6);
  });

  it('Atom 分期', () => {
    const r = roundTrip({ platform_fee_type: 'atom_installment', installment_period: 12 });
    expect(r.pipelineNet).toBeCloseTo(r.sellerNet, 6);
  });

  it('Escrow 分期', () => {
    const r = roundTrip({ platform_fee_type: 'escrow_installment', installment_period: 12 });
    expect(r.pipelineNet).toBeCloseTo(r.sellerNet, 6);
  });

  it('每期金额是 amount 的纯拆分，收据合计正好等于 amount', () => {
    const r = roundTrip({ downpayment_amount: 2500, final_payment_amount: 500 });
    const regular = r.v.installment_period - 1;
    const receiptsTotal =
      r.v.downpayment_amount + r.v.installment_amount * regular + r.v.final_payment_amount;
    expect(receiptsTotal).toBeCloseTo(r.v.amount, 6);
  });
});

describe('期数被尾款吃光', () => {
  it('1 期且填了尾款 → 每期金额归零，而不是留下陈旧值', () => {
    // 以前这里 effect 直接 return，installment_amount 保留上一次配置的值，
    // ReceiptsModal 照样拿它去预填收据。
    const v = formValues({ installment_period: 1, final_payment_amount: 4000 });
    expect(autoInstallmentAmount(v)).toBe(0);
  });
});
