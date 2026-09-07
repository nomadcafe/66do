import { describe, it, expect } from 'vitest';
import {
  installmentFeeFromFormValues,
  sellerSidePlatformFee,
  type InstallmentFeeFormValues,
} from './platformFeeCalculator';

function values(over: Partial<InstallmentFeeFormValues> = {}): InstallmentFeeFormValues {
  return {
    amount: 10000,
    platformFeePercentage: 0,
    installment_amount: 850,
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

describe('installmentFeeFromFormValues', () => {
  it('算不出来时返回 null，不抛', () => {
    expect(installmentFeeFromFormValues(values({ installment_amount: 0 }))).toBeNull();
    expect(installmentFeeFromFormValues(values({ installment_amount: -5 }))).toBeNull();
  });

  it('Afternic 10 期 / NS 指向：标价 $10,000、卖家净 $8,500', () => {
    // 有效佣金 15%（基础 15%，0–12 月无折扣），10 期无买家服务费
    const r = installmentFeeFromFormValues(values());
    expect(r).not.toBeNull();
    expect(r!.sellerNetAmount).toBeCloseTo(8500, 6);
    expect(r!.breakdown.baseAmount).toBeCloseTo(10000, 6);
  });
});

describe('sellerSidePlatformFee', () => {
  // 回归：这个值以前根本没被写进 platform_fee —— 预览框算出来显示给用户看，
  // 保存时 platform_fee 仍是 0、net_amount = amount = 毛额，于是全站净额口径
  // 在分期销售上都按毛额走，Performance 的「Platform Fees」tile 恒为 $0。
  it('等于 amount − 卖家净收入，正好让 net_amount 落在卖家实收上', () => {
    const r = installmentFeeFromFormValues(values());
    const fee = sellerSidePlatformFee(10000, r);
    expect(fee).toBeCloseTo(1500, 6);
    // performSave 存的是 net_amount = amount − platform_fee
    expect(10000 - fee!).toBeCloseTo(r!.sellerNetAmount, 6);
  });

  it('不把买家服务费算进卖家的扣减', () => {
    // 24 期：买家服务费 10%，卖家佣金有 5% 折扣 → 有效 10%
    const r = installmentFeeFromFormValues(
      values({ installment_period: 24, installment_amount: 9000 / 24 })
    );
    const fee = sellerSidePlatformFee(10000, r)!;
    // result.platformFee 含买家服务费，比卖家侧扣减大
    expect(r!.platformFee).toBeGreaterThan(fee);
    expect(10000 - fee).toBeCloseTo(r!.sellerNetAmount, 6);
  });

  it('卖家净收入超过标价时归 0（Atom surcharge 分成可能出现）', () => {
    const fee = sellerSidePlatformFee(1000, {
      customerTotalAmount: 1200,
      platformFee: 100,
      platformFeeRate: 0.1,
      sellerNetAmount: 1100,
      breakdown: { baseAmount: 1000, feeAmount: 100 },
    });
    expect(fee).toBe(0);
  });

  it('没有结果或金额为 0 时返回 null，不写脏数据', () => {
    expect(sellerSidePlatformFee(10000, null)).toBeNull();
    expect(sellerSidePlatformFee(0, installmentFeeFromFormValues(values()))).toBeNull();
  });
});
