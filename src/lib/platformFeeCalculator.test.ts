/**
 * Smoke tests for the platform fee calculator. The full suite (every tier,
 * every period bracket, every edge case discovered during the recent
 * Afternic / Atom / Escrow rewrites) lands in a follow-up commit; this file
 * only proves that the test infrastructure itself works.
 */
import { describe, it, expect } from 'vitest';
import {
  calculatePlatformFee,
  getAfternicEffectiveCommissionRate,
  getAtomBaseCommissionAmount,
  getAtomSurchargeRate,
  getEscrowMonthlyHoldingFee,
  ATOM_SURCHARGE_SELLER_SHARE,
} from './platformFeeCalculator';

describe('platformFeeCalculator (smoke)', () => {
  it('Afternic 36mo NS-pointed → 5% effective commission', () => {
    expect(getAfternicEffectiveCommissionRate(36, true, false)).toBeCloseTo(0.05, 10);
  });

  it('Atom Standard 7.5% on $10,000', () => {
    expect(getAtomBaseCommissionAmount(10_000, 'standard')).toBeCloseTo(750, 10);
  });

  it('Atom 48-month surcharge defaults to 25%', () => {
    expect(getAtomSurchargeRate(48)).toBeCloseTo(0.25, 10);
  });

  it('Atom seller surcharge share is 65%', () => {
    expect(ATOM_SURCHARGE_SELLER_SHARE).toBeCloseTo(0.65, 10);
  });

  it('Escrow LWP holding fee on $50,000 → $100/mo (min dominates)', () => {
    expect(getEscrowMonthlyHoldingFee(50_000, 'lease_with_purchase')).toBeCloseTo(100, 10);
  });

  it('calculatePlatformFee(standard, 15%) → buyer = sellerNet / 0.85', () => {
    const result = calculatePlatformFee({
      type: 'standard',
      installmentPeriod: 1,
      sellerAmount: 8500,
      customFeeRate: 0.15,
    });
    expect(result.customerTotalAmount).toBeCloseTo(10_000, 6);
    expect(result.platformFee).toBeCloseTo(1500, 6);
    expect(result.sellerNetAmount).toBeCloseTo(8500, 6);
  });
});
