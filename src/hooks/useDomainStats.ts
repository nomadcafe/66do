import { useMemo } from 'react';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import { calculateBasicFinancialMetrics } from '../lib/coreCalculations';
import { realizedROI } from '../lib/realizedPnL';

export interface DomainStats {
  totalDomains: number;
  activeDomains: number;
  soldDomains: number;
  totalRevenue: number;
  /** Realized ROI: Σ(sold profit) / Σ(sold cost basis) × 100. Aligns with
   *  Hero's Realized P&L semantic — both reflect only completed trades.
   *  The previous basic.roi (= totalRevenue/totalInvestment − 1) included
   *  cost basis of held inventory, so it could be deeply negative while
   *  Realized P&L is positive. */
  roi: number;
}

export function useDomainStats(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): DomainStats {
  return useMemo(() => {
    const basic = calculateBasicFinancialMetrics(domains, transactions);
    return {
      totalDomains: domains.length,
      activeDomains: domains.filter((d) => d.status === 'active').length,
      soldDomains: domains.filter((d) => d.status === 'sold').length,
      totalRevenue: basic.totalRevenue,
      roi: realizedROI(domains, transactions),
    };
  }, [domains, transactions]);
}
