/**
 * Platform fee calculator coverage.
 *
 * Every regression we shipped during the recent Afternic / Atom / Escrow
 * rewrites is locked in here. Adding new tiers, brackets, or platforms
 * means adding a row to the relevant table-driven block — keep new cases
 * tabular so the next rewrite (or model change from the marketplaces) is
 * obvious in the diff.
 */
import { describe, it, expect } from 'vitest';
import {
  calculatePlatformFee,
  calculateCustomerTotalFromInstallment,
  calculatePaidAmountFromInstallment,
  calculateTotalInstallmentAmount,
  STANDARD_INSTALLMENT_TOTAL_SALE_FEE_RATE,
  SPACESHIP_INSTALLMENT_DEFAULT_FEE_RATE,
  getAfternicCommissionDiscount,
  getAfternicStandardCommissionRate,
  getAfternicEffectiveCommissionRate,
  getAtomBaseCommissionAmount,
  getAtomSurchargeRate,
  getEscrowMonthlyHoldingFee,
  getEscrowHoldingFee,
  ATOM_SURCHARGE_SELLER_SHARE,
} from './platformFeeCalculator';

const APPROX = 1e-6;

// ───────────────────────────── Standard ─────────────────────────────
describe('calculateStandardFee', () => {
  it('reverse-derives customer total from seller net at 15%', () => {
    const r = calculatePlatformFee({
      type: 'standard',
      installmentPeriod: 1,
      sellerAmount: 8500,
      customFeeRate: 0.15,
    });
    expect(r.customerTotalAmount).toBeCloseTo(10_000, 4);
    expect(r.platformFee).toBeCloseTo(1500, 4);
    expect(r.sellerNetAmount).toBeCloseTo(8500, 4);
  });

  it('defaults to 15% when no customFeeRate is provided', () => {
    const r = calculatePlatformFee({ type: 'standard', installmentPeriod: 1, sellerAmount: 8500 });
    expect(r.platformFeeRate).toBeCloseTo(0.15, 4);
  });
});

// ───────────────────────────── Afternic ─────────────────────────────
describe('Afternic helpers', () => {
  // standardCommissionRate = (NS pointed ? 15% : 25%) + (premium ? +5% : 0)
  it.each([
    [true, false, 0.15],
    [true, true, 0.20],
    [false, false, 0.25],
    [false, true, 0.30],
  ])('standardCommissionRate(NS=%s, premium=%s) → %d', (ns, prem, expected) => {
    expect(getAfternicStandardCommissionRate(ns, prem)).toBeCloseTo(expected, 10);
  });

  it.each([
    [12, 0],
    [13, 0.05],
    [24, 0.05],
    [25, 0.10],
    [36, 0.10],
    [37, 0.15],
    [60, 0.15],
    [120, 0.15], // capped
  ])('commissionDiscount(period=%d) → %d', (period, expected) => {
    expect(getAfternicCommissionDiscount(period)).toBeCloseTo(expected, 10);
  });

  it('clamps effective rate at 0 (no negative commission)', () => {
    // Hypothetical: discount > standard. NS-pointed (15%) at >36mo gives 15-15=0.
    expect(getAfternicEffectiveCommissionRate(60, true, false)).toBeCloseTo(0, 10);
  });

  it('NS-pointed 36mo → 5% effective (the canonical user case)', () => {
    expect(getAfternicEffectiveCommissionRate(36, true, false)).toBeCloseTo(0.05, 10);
  });
});

describe('calculateAfternicInstallmentFee', () => {
  // The form sets installment_amount = sellerNet / period, so
  // sellerAmount input here = sellerNet, and the calc reverse-derives
  // listPrice. canonical case from the chat: amount input $5,000 (= net),
  // 36 months, NS pointed, no premium → listPrice ≈ $5,263.16 etc.
  it('NS-pointed, 36mo, $5,000 net → matches Afternic LTO breakdown', () => {
    const r = calculatePlatformFee({
      type: 'afternic_installment',
      installmentPeriod: 36,
      sellerAmount: 5000,
      afternicNsPointed: true,
      afternicPremiumAddon: false,
    });
    expect(r.breakdown.baseAmount).toBeCloseTo(5263.157894, 4);  // listPrice
    expect(r.breakdown.commission).toBeCloseTo(263.157894, 4);   // 5%
    expect(r.breakdown.serviceFee).toBeCloseTo(1052.6315, 3);    // 20% serviceFee
    expect(r.customerTotalAmount).toBeCloseTo(6315.789, 2);
    expect(r.sellerNetAmount).toBeCloseTo(5000, 4);
  });

  it('user-input service-fee rate of 0 falls back to tier when period > 12', () => {
    // Regression: a 36mo installment with the form's default
    // user_input_fee_rate=0 should not zero out the 20% service fee.
    const r = calculatePlatformFee({
      type: 'afternic_installment',
      installmentPeriod: 36,
      sellerAmount: 5000,
      userInputFeeRate: 0,
    });
    expect(r.breakdown.serviceFeeRate).toBeCloseTo(0.20, 4);
    expect(r.breakdown.serviceFee).toBeCloseTo(5263.16 * 0.20, 1);
  });

  it('user-input service-fee rate is honoured when explicit non-zero', () => {
    const r = calculatePlatformFee({
      type: 'afternic_installment',
      installmentPeriod: 36,
      sellerAmount: 5000,
      userInputFeeRate: 0.10,
    });
    expect(r.breakdown.serviceFeeRate).toBeCloseTo(0.10, 4);
  });

  it('zero effective commission keeps listPrice = sellerNet (no division by zero)', () => {
    // 60mo NS-pointed = 15% - 15% = 0%. listPrice should equal sellerAmount.
    const r = calculatePlatformFee({
      type: 'afternic_installment',
      installmentPeriod: 60,
      sellerAmount: 5000,
      afternicNsPointed: true,
      afternicPremiumAddon: false,
    });
    expect(r.breakdown.baseAmount).toBeCloseTo(5000, 4);
    expect(r.breakdown.commission).toBeCloseTo(0, 4);
  });
});

// ─────────────────────────────── Atom ───────────────────────────────
describe('Atom helpers', () => {
  it.each([
    [11, 0],     // <12mo: no surcharge
    [12, 0.10],
    [13, 0.15],
    [24, 0.15],
    [25, 0.20],
    [36, 0.20],
    [37, 0.25],
    [48, 0.25],
    [60, 0.25],  // > 48 capped at 25%
  ])('surcharge(period=%d) = %d', (period, expected) => {
    expect(getAtomSurchargeRate(period)).toBeCloseTo(expected, 10);
  });

  it.each([
    // tier, listPrice, expectedCommission (USD)
    ['standard', 10_000, 750] as const,
    ['plus', 10_000, 1500] as const,
    // Premium brackets:
    ['premium', 4998, 4998 * 0.30] as const,
    ['premium', 4999, 4999 * 0.25] as const,
    ['premium', 49_999, 49_999 * 0.25] as const,
    ['premium', 50_000, 50_000 * 0.20] as const,
    ['premium', 74_999, 74_999 * 0.20] as const,
    ['premium', 75_000, 75_000 * 0.15] as const,
    // BYOL brackets — boundaries per the user's published table:
    //   $0–$4,999 / $5k–$49,999 / $50k–$199,999 / $200k–$499,999 /
    //   $500k–$999,999 / $1M–$2,999,999 / $3M–$9,999,999 / ≥$10M
    ['byol', 4_999, 4_999 * 0.045] as const,         // 4.5%
    ['byol', 49_999, 49_999 * 0.045] as const,       // 4.5%
    ['byol', 50_000, 50_000 * 0.0375] as const,      // 3.75%
    ['byol', 199_999, 199_999 * 0.0375] as const,    // 3.75%
    ['byol', 200_000, 200_000 * 0.029] as const,     // 2.9% — bracket starts here
    ['byol', 499_999, 499_999 * 0.029] as const,     // 2.9%
    ['byol', 500_000, 500_000 * 0.0225] as const,    // 2.25%
    ['byol', 999_999, 999_999 * 0.0225] as const,    // 2.25%
    ['byol', 1_000_000, 1_000_000 * 0.019] as const, // 1.9% — bracket starts here
    ['byol', 2_999_999, 2_999_999 * 0.019] as const, // 1.9%
    ['byol', 3_000_000, 3_000_000 * 0.0175] as const, // 1.75%
    ['byol', 10_000_000, 10_000_000 * 0.0135] as const, // 1.35% (≥$10M)
  ])('baseCommission(tier=%s, listPrice=$%d) = $%d', (tier, listPrice, expected) => {
    const got = getAtomBaseCommissionAmount(listPrice, tier);
    expect(got).toBeCloseTo(expected, 2);
  });

  it('BYOL applies $25 floor when listPrice is small', () => {
    // 4.5% × $300 = $13.50, but BYOL floor is $25 below $5k.
    expect(getAtomBaseCommissionAmount(300, 'byol')).toBeCloseTo(25, 4);
    // Above the $25 / 0.045 ≈ $555.55 break-even point, the rate dominates.
    expect(getAtomBaseCommissionAmount(600, 'byol')).toBeCloseTo(27, 4);
  });

  it('Premium ≤ $4,998 with No-coin bumps 30% → 35%', () => {
    expect(getAtomBaseCommissionAmount(4998, 'premium', { noCoin: true })).toBeCloseTo(4998 * 0.35, 4);
    // No-coin only bumps the ≤ $4,998 bracket; higher tiers are unaffected.
    expect(getAtomBaseCommissionAmount(5000, 'premium', { noCoin: true })).toBeCloseTo(5000 * 0.25, 4);
  });

  it('Custom tier uses options.customRate (defaulting to 0)', () => {
    expect(getAtomBaseCommissionAmount(10_000, 'custom', { customRate: 0.06 })).toBeCloseTo(600, 4);
    expect(getAtomBaseCommissionAmount(10_000, 'custom')).toBeCloseTo(0, 4);
  });

  it('zero or negative listPrice short-circuits to 0', () => {
    expect(getAtomBaseCommissionAmount(0, 'plus')).toBeCloseTo(0, 4);
    expect(getAtomBaseCommissionAmount(-100, 'standard')).toBeCloseTo(0, 4);
  });
});

describe('calculateAtomInstallmentFee', () => {
  it('canonical $7,200 / 36mo / Premium 25% bracket — Atom worked example', () => {
    const r = calculatePlatformFee({
      type: 'atom_installment',
      installmentPeriod: 36,
      sellerAmount: 7200, // listPrice
      atomCommissionTier: 'premium',
      atomNoCoin: false,
    });
    expect(r.breakdown.baseAmount).toBeCloseTo(7200, 4);            // listPrice
    expect(r.breakdown.atomBaseCommission).toBeCloseTo(1800, 4);    // 25% of $7,200
    expect(r.breakdown.surchargeAmount).toBeCloseTo(1440, 4);       // 20% of $7,200
    expect(r.breakdown.sellerSurchargeShare).toBeCloseTo(936, 4);   // 65% of surcharge
    expect(r.customerTotalAmount).toBeCloseTo(8640, 4);
    expect(r.sellerNetAmount).toBeCloseTo(6336, 4);                 // 5400 + 936
    expect(r.platformFee).toBeCloseTo(2304, 4);                     // 1800 + 504
  });

  it('user-input surcharge rate of 0 falls back to tier when period >= 12', () => {
    // Regression: form's user_input_surcharge_rate default is 0; calc must
    // treat that as "use tier" rather than literal 0%.
    const r = calculatePlatformFee({
      type: 'atom_installment',
      installmentPeriod: 48,
      sellerAmount: 130_560,
      userInputSurchargeRate: 0,
      atomCommissionTier: 'standard',
    });
    expect(r.breakdown.surchargeRate).toBeCloseTo(0.25, 4);
    expect(r.breakdown.surchargeAmount).toBeCloseTo(32_640, 4);
    expect(r.sellerNetAmount).toBeCloseTo(141_984, 1);
  });

  it('< 12 month installments correctly have 0% surcharge from tier', () => {
    const r = calculatePlatformFee({
      type: 'atom_installment',
      installmentPeriod: 6,
      sellerAmount: 10_000,
      atomCommissionTier: 'plus',
    });
    expect(r.breakdown.surchargeRate).toBeCloseTo(0, 4);
    expect(r.breakdown.surchargeAmount).toBeCloseTo(0, 4);
    // Plus 15% commission, no surcharge: seller keeps 85%.
    expect(r.sellerNetAmount).toBeCloseTo(8500, 4);
  });

  it('explicit non-zero surchargeRate override is honoured', () => {
    const r = calculatePlatformFee({
      type: 'atom_installment',
      installmentPeriod: 36,
      sellerAmount: 10_000,
      userInputSurchargeRate: 0.30, // override above the 36mo default of 20%
      atomCommissionTier: 'standard',
    });
    expect(r.breakdown.surchargeRate).toBeCloseTo(0.30, 4);
  });

  it('default tier when none specified is Standard 7.5%', () => {
    const r = calculatePlatformFee({
      type: 'atom_installment',
      installmentPeriod: 36,
      sellerAmount: 10_000,
    });
    expect(r.breakdown.atomBaseCommissionRate).toBeCloseTo(0.075, 4);
    expect(r.breakdown.atomCommissionTier).toBe('standard');
  });
});

// ──────────────────────────────── Escrow ────────────────────────────────
describe('Escrow helpers', () => {
  it.each([
    // (listPrice, leaseType, expected monthly)
    [50_000, 'lease_with_purchase', 100] as const, // floor dominates: $5 < $100
    [2_000_000, 'lease_with_purchase', 200] as const, // 0.01% × $2M = $200
    [5_000, 'lease_only', 200] as const, // floor dominates: $1 < $200
    [2_000_000, 'lease_only', 400] as const, // 0.02% × $2M = $400
    [0, 'lease_with_purchase', 0] as const,
    [-100, 'lease_only', 0] as const,
  ])('monthly holding(price=$%d, %s) = $%d', (price, lease, expected) => {
    expect(getEscrowMonthlyHoldingFee(price, lease)).toBeCloseTo(expected, 4);
  });

  it('total holding = monthly × period', () => {
    expect(getEscrowHoldingFee(50_000, 24, 'lease_with_purchase')).toBeCloseTo(2400, 4);
  });

  it('zero or negative period gives zero holding fee', () => {
    expect(getEscrowHoldingFee(50_000, 0, 'lease_with_purchase')).toBeCloseTo(0, 4);
    expect(getEscrowHoldingFee(50_000, -3, 'lease_only')).toBeCloseTo(0, 4);
  });
});

describe('calculateEscrowInstallmentFee', () => {
  it('canonical $50k / 24mo / LWP / $1,200 transaction fee', () => {
    const r = calculatePlatformFee({
      type: 'escrow_installment',
      installmentPeriod: 24,
      sellerAmount: 50_000,
      escrowFee: 1200,
      escrowLeaseType: 'lease_with_purchase',
    });
    expect(r.breakdown.escrowHoldingFee).toBeCloseTo(2400, 4);
    expect(r.breakdown.escrowMonthlyHoldingFee).toBeCloseTo(100, 4);
    expect(r.breakdown.escrowTransactionFee).toBeCloseTo(1200, 4);
    expect(r.customerTotalAmount).toBeCloseTo(53_600, 4);
    expect(r.sellerNetAmount).toBeCloseTo(50_000, 4);
    expect(r.platformFee).toBeCloseTo(3600, 4);
  });

  it('manual domainHoldingFee override beats auto-derive', () => {
    const r = calculatePlatformFee({
      type: 'escrow_installment',
      installmentPeriod: 24,
      sellerAmount: 50_000,
      domainHoldingFee: 9999, // explicit override
      escrowLeaseType: 'lease_with_purchase',
    });
    expect(r.breakdown.escrowHoldingFee).toBeCloseTo(9999, 4);
  });

  it('defaults missing leaseType to lease_with_purchase', () => {
    const r = calculatePlatformFee({
      type: 'escrow_installment',
      installmentPeriod: 12,
      sellerAmount: 10_000,
    });
    expect(r.breakdown.escrowLeaseType).toBe('lease_with_purchase');
    // 0.01% × $10k = $1 < $100 floor, ×12 months = $1200.
    expect(r.breakdown.escrowHoldingFee).toBeCloseTo(1200, 4);
  });
});

// ──────────────────── Helpers used by the InstallmentConfig UI ───────────────────
describe('calculateTotalInstallmentAmount', () => {
  it('sums downpayment + regular×periods + final', () => {
    expect(calculateTotalInstallmentAmount(500, 100, 12, 0)).toBe(500 + 100 * 12);
    expect(calculateTotalInstallmentAmount(500, 100, 12, 200)).toBe(500 + 100 * 11 + 200);
  });
});

describe('Spaceship 两个入口口径一致', () => {
  // 曾经不一致：calculatePlatformFee 走 sellerAmount / (1 − 5%) 反推，
  // calculateCustomerTotalFromInstallment 走 总额 × 5%，同一笔交易两个答案。
  it('calculatePlatformFee 与 calculateCustomerTotalFromInstallment 给出同一结果', () => {
    const viaConfig = calculatePlatformFee({
      type: 'spaceship_installment',
      installmentPeriod: 12,
      sellerAmount: 1200, // = installmentAmount × period，即分期总额
      customFeeRate: 0.05,
    });
    const viaInstallment = calculateCustomerTotalFromInstallment(100, 12, 'spaceship_installment', 0.05);

    expect(viaConfig.customerTotalAmount).toBeCloseTo(viaInstallment.customerTotalAmount, 4);
    expect(viaConfig.platformFee).toBeCloseTo(viaInstallment.platformFee, 4);
    expect(viaConfig.sellerNetAmount).toBeCloseTo(viaInstallment.sellerNetAmount, 4);
  });

  it('平台费是总额 × 费率，不是从卖家净额反推出来的', () => {
    const r = calculatePlatformFee({
      type: 'spaceship_installment',
      installmentPeriod: 12,
      sellerAmount: 1200,
      customFeeRate: 0.05,
    });
    expect(r.platformFee).toBeCloseTo(60, 4); // 反推口径会得到 63.16
    expect(r.sellerNetAmount).toBeCloseTo(1140, 4); // 反推口径会得到 1200
    expect(r.platformFeeRate).toBeCloseTo(0.05, 4);
  });
});

describe('calculateCustomerTotalFromInstallment', () => {
  it('Spaceship 带交易自身费率 5% → totalSale × 5%', () => {
    const r = calculateCustomerTotalFromInstallment(100, 12, 'spaceship_installment', 0.05);
    // totalSale = 100 × 12 = 1200
    expect(r.customerTotalAmount).toBeCloseTo(1200, 4);
    expect(r.platformFee).toBeCloseTo(60, 4);
    expect(r.sellerNetAmount).toBeCloseTo(1140, 4);
  });

  it('Spaceship 未记录费率 → 走当前默认值（2026-09 起 10%）', () => {
    const r = calculateCustomerTotalFromInstallment(100, 12, 'spaceship_installment');
    expect(r.platformFeeRate).toBeCloseTo(SPACESHIP_INSTALLMENT_DEFAULT_FEE_RATE, 6);
    expect(r.platformFee).toBeCloseTo(1200 * SPACESHIP_INSTALLMENT_DEFAULT_FEE_RATE, 4);
  });

  it('Standard installment → totalSale × default 10%', () => {
    const r = calculateCustomerTotalFromInstallment(100, 12, 'standard');
    expect(r.platformFeeRate).toBeCloseTo(STANDARD_INSTALLMENT_TOTAL_SALE_FEE_RATE, 4);
  });

  it('Standard installment with customFeeRate override (0.08)', () => {
    const r = calculateCustomerTotalFromInstallment(100, 12, 'standard', 0.08);
    expect(r.platformFeeRate).toBeCloseTo(0.08, 4);
  });

  it('Atom with grossAmount uses listPrice rather than installment×period', () => {
    // installmentAmount × period = $141,984 (= sellerNet for $130,560/48mo Standard).
    // But listPrice should be $130,560. Forwarding grossAmount tells the calculator
    // not to mistake installment×period for listPrice.
    const r = calculateCustomerTotalFromInstallment(
      2958, 48, 'atom_installment',
      undefined, undefined, undefined, undefined, 0,
      {
        grossAmount: 130_560,
        atomCommissionTier: 'standard',
      }
    );
    expect(r.breakdown.baseAmount).toBeCloseTo(130_560, 4);
    expect(r.customerTotalAmount).toBeCloseTo(163_200, 4);
    expect(r.sellerNetAmount).toBeCloseTo(141_984, 1);
  });
});

describe('calculatePaidAmountFromInstallment', () => {
  it('Spaceship: paidPeriods proportionally scales fee + customer total', () => {
    const r = calculatePaidAmountFromInstallment(100, 6, 12, 'spaceship_installment', 0.05);
    // Half-paid → half of totalResult.
    expect(r.customerTotalAmount).toBeCloseTo(600, 4);
    expect(r.platformFee).toBeCloseTo(30, 4);
    // sellerNet = received so far - platform fee paid = 600 - 30 = 570
    expect(r.sellerNetAmount).toBeCloseTo(570, 4);
  });

  it('Atom: sellerNet proration uses listPrice-based total, not installment×paid', () => {
    // 12 of 36 paid on $130,560 / Standard: customer pays 1/3, fee 1/3, sellerNet 1/3.
    const r = calculatePaidAmountFromInstallment(
      2958 * (36 / 48),  // ~ monthly seller take for a 36mo Standard 130560 deal — used loosely
      12, 36,
      'atom_installment',
      undefined, undefined, undefined, undefined, 0,
      {
        grossAmount: 130_560,
        atomCommissionTier: 'standard',
      }
    );
    // Standard 7.5%, 36mo surcharge=20%, sellerSurchargeShare 13%. Net rate vs list = 1 - 0.075 + 0.13 = 1.055.
    // sellerNet total = 130560 × 1.055 = 137,740.80 → 1/3 ≈ 45,913.60
    expect(r.sellerNetAmount).toBeCloseTo(137_740.80 / 3, 0);
  });
});

// ────────────────────────── Constants we depend on ──────────────────────────
describe('exported constants', () => {
  it('ATOM_SURCHARGE_SELLER_SHARE = 65%', () => {
    expect(ATOM_SURCHARGE_SELLER_SHARE).toBeCloseTo(0.65, 10);
  });

  it('STANDARD_INSTALLMENT_TOTAL_SALE_FEE_RATE = 10%', () => {
    expect(STANDARD_INSTALLMENT_TOTAL_SALE_FEE_RATE).toBeCloseTo(0.10, 10);
  });
});

// keep APPROX referenced so a future contributor sees it without lint nag
void APPROX;

describe('首付 / 尾款必须计入卖家总额', () => {
  // 表单推每期金额时是先把首付和尾款从卖家净收入里扣掉的
  // （TransactionForm: remainingAmount = sellerProceeds − downpayment − finalPayment），
  // 所以费用计算这边必须再把它们加回来。Afternic 路径曾经写成
  // `installmentAmount × installmentPeriod`，首付整笔从所有数字里消失。
  const listPrice = 10000;
  const period = 24;
  const down = 2000;

  const perPeriod = (dp: number, fp: number) => {
    const eff = getAfternicEffectiveCommissionRate(period, true, false);
    const regular = period - (fp > 0 ? 1 : 0);
    return (listPrice * (1 - eff) - dp - fp) / regular;
  };

  it('Afternic + 首付：客户总付 / 平台费 / 卖家净都不受首付"蒸发"影响', () => {
    const instAmt = perPeriod(down, 0);
    const opts = { downpaymentAmount: down, finalPaymentAmount: 0, grossAmount: listPrice };
    const r = calculateCustomerTotalFromInstallment(
      instAmt, period, 'afternic_installment', undefined, undefined, undefined, undefined, undefined, opts
    );
    // 有效佣金率 15% − 5%(13–24 月折扣) = 10% → 标价 10000、卖家净 9000
    // 服务费 13–24 月 10% → 客户总付 11000、平台费 = 服务费 1000 + 佣金 1000
    expect(r.sellerNetAmount).toBeCloseTo(9000, 6);
    expect(r.customerTotalAmount).toBeCloseTo(11000, 6);
    expect(r.platformFee).toBeCloseTo(2000, 6);
  });

  it('全部付清时，配置面板与 dashboard 重算给出同一组数', () => {
    const instAmt = perPeriod(down, 0);
    const opts = { downpaymentAmount: down, finalPaymentAmount: 0, grossAmount: listPrice };
    const config = calculateCustomerTotalFromInstallment(
      instAmt, period, 'afternic_installment', undefined, undefined, undefined, undefined, undefined, opts
    );
    const paid = calculatePaidAmountFromInstallment(
      instAmt, period, period, 'afternic_installment', undefined, undefined, undefined, undefined, undefined, opts
    );
    expect(paid.customerTotalAmount).toBeCloseTo(config.customerTotalAmount, 6);
    expect(paid.platformFee).toBeCloseTo(config.platformFee, 6);
    expect(paid.sellerNetAmount).toBeCloseTo(config.sellerNetAmount, 6);
  });

  it('付到一半时，卖家实收 = 首付 + 已付期数 × 每期', () => {
    const instAmt = perPeriod(down, 0);
    const r = calculatePaidAmountFromInstallment(
      instAmt, 12, period, 'afternic_installment', undefined, undefined, undefined, undefined, undefined,
      { downpaymentAmount: down, finalPaymentAmount: 0, grossAmount: listPrice }
    );
    expect(r.sellerNetAmount).toBeCloseTo(down + instAmt * 12, 6);
  });

  it('没有首付也没有尾款时行为不变（这次改动是推广，不是变更）', () => {
    const instAmt = perPeriod(0, 0);
    const r = calculatePaidAmountFromInstallment(
      instAmt, period, period, 'afternic_installment', undefined, undefined, undefined, undefined, undefined,
      { grossAmount: listPrice }
    );
    expect(r.sellerNetAmount).toBeCloseTo(9000, 6);
    expect(r.customerTotalAmount).toBeCloseTo(11000, 6);
  });

  it('有尾款时，最后一期按尾款算而不是按每期金额算', () => {
    // 首付 1000 + 11 × 300 + 尾款 2000 = 6300
    const total = calculateTotalInstallmentAmount(1000, 300, 12, 2000);
    expect(total).toBe(6300);
    const r = calculatePaidAmountFromInstallment(
      300, 12, 12, 'spaceship_installment', undefined, undefined, undefined, undefined, undefined,
      { downpaymentAmount: 1000, finalPaymentAmount: 2000 }
    );
    // 全部付清 → 客户已付必须等于总售价；旧实现按 1000 + 12×300 = 4600 算
    expect(r.customerTotalAmount).toBeCloseTo(6300, 6);
  });
});

describe('平台调价不追溯到历史交易', () => {
  // 2026-09 Spaceship 从 5% 调到 10%。费率是有生效日期的商业条款，
  // 而平台费 = 总售价 × 费率 × 已付比例 —— 费率作用在整笔交易上。
  // 所以按旧费率成交的交易必须把自己的费率记在 platform_fee_percentage 上，
  // 否则调价当天所有历史 Spaceship 分期（含正在收款那笔的已收部分）会被
  // 集体重新定价。这一组锁住"交易自带费率优先于默认值"。
  const totalSale = 100 * 12;

  it('记了 5% 的旧交易，在默认值已是 10% 的情况下仍按 5% 算', () => {
    const r = calculateCustomerTotalFromInstallment(100, 12, 'spaceship_installment', 0.05);
    expect(r.platformFee).toBeCloseTo(totalSale * 0.05, 6);
    expect(SPACESHIP_INSTALLMENT_DEFAULT_FEE_RATE).toBeCloseTo(0.1, 6); // 默认值确实是 10%
  });

  it('进行中的分期：收款进度推进，费率仍取交易自带的那个', () => {
    for (const paid of [6, 12, 18, 24]) {
      const r = calculatePaidAmountFromInstallment(100, paid, 24, 'spaceship_installment', 0.05);
      // 平台费恒为「已付金额 × 5%」，不随默认值变化
      expect(r.platformFee).toBeCloseTo(100 * paid * 0.05, 6);
      expect(r.sellerNetAmount).toBeCloseTo(100 * paid * 0.95, 6);
    }
  });

  it('新交易没记费率时才落到默认值', () => {
    const r = calculatePaidAmountFromInstallment(100, 12, 12, 'spaceship_installment');
    expect(r.platformFee).toBeCloseTo(totalSale * SPACESHIP_INSTALLMENT_DEFAULT_FEE_RATE, 6);
  });
});

describe('Escrow 托管费：留空 vs 填 0', () => {
  // 以前判断写的是 `domainHoldingFee > 0 ? 用它 : 自动估算`，于是填 0 会静默
  // 回退到自动值 —— 用户根本关不掉它。加上当时既没有持久化字段、两条调用路径
  // 又都硬传 undefined，结果就是系统给每笔 Escrow 分期凭空加一笔谁都没付过的
  // 托管费（15 万 / 24 期的交易被加了 2400）。
  const listPrice = 150000;
  const periods = 24;
  const per = (listPrice - 75000) / periods;
  const base = {
    downpaymentAmount: 75000,
    finalPaymentAmount: 0,
    grossAmount: listPrice,
    escrowLeaseType: 'lease_with_purchase' as const,
  };
  const run = (holding: number | undefined) =>
    calculatePaidAmountFromInstallment(
      per, periods, periods, 'escrow_installment', undefined, 0, holding, undefined, undefined, base
    );

  it('留空（undefined）→ 自动估算：max(100, 标价×0.0001) × 期数 = 2400', () => {
    expect(run(undefined).platformFee).toBeCloseTo(2400, 6);
  });

  it('填 0 → 就是没有托管费，不再回退到自动值', () => {
    const r = run(0);
    expect(r.platformFee).toBeCloseTo(0, 6);
    expect(r.customerTotalAmount).toBeCloseTo(listPrice, 6);
    expect(r.sellerNetAmount).toBeCloseTo(listPrice, 6);
  });

  it('填了具体金额 → 用这个金额，覆盖自动估算', () => {
    expect(run(5863).platformFee).toBeCloseTo(5863, 6);
  });
});
