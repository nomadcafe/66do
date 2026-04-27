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
  return useMemo(
    () => ({
      basic: calculateBasicFinancialMetrics(domains, transactions),
      advanced: calculateAdvancedFinancialMetrics(domains, transactions),
      domainPerformance: calculateDomainPerformance(domains, transactions),
    }),
    [domains, transactions]
  );
}
