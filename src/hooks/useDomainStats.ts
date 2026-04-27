import { useMemo } from 'react';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import { calculateBasicFinancialMetrics } from '../lib/coreCalculations';

export interface DomainStats {
  totalDomains: number;
  activeDomains: number;
  soldDomains: number;
  totalRevenue: number;
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
      roi: basic.roi,
    };
  }, [domains, transactions]);
}
