import { useMemo } from 'react';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import {
  calculateBasicFinancialMetrics,
  calculateAdvancedFinancialMetrics,
  calculateDomainPerformance,
} from '../lib/coreCalculations';

export function useComprehensiveFinancialAnalysis(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
) {
  return useMemo(() => {
    const basic = calculateBasicFinancialMetrics(domains, transactions);
    return {
      basic,
      advanced: calculateAdvancedFinancialMetrics(domains, transactions, basic),
      domainPerformance: calculateDomainPerformance(domains, transactions),
    };
  }, [domains, transactions]);
}
