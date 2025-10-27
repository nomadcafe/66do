import { useMemo } from 'react';
// import { Domain, DomainTransaction as Transaction } from '../types/domain';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import {
  calculateBasicFinancialMetrics,
  calculateAdvancedFinancialMetrics,
  calculateDomainPerformance,
  calculateMonthlyReturns,
  calculateVolatility,
  calculateMaxDrawdown,
  calculateRiskLevel,
  calculateSuccessRate,
  BasicFinancialMetrics,
  AdvancedFinancialMetrics,
  DomainPerformance
} from '../lib/coreCalculations';

// 基础财务计算hook
export function useBasicFinancialMetrics(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): BasicFinancialMetrics {
  return useMemo(() => {
    return calculateBasicFinancialMetrics(domains, transactions);
  }, [domains, transactions]);
}

// 高级财务计算hook
export function useAdvancedFinancialMetrics(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): AdvancedFinancialMetrics {
  return useMemo(() => {
    return calculateAdvancedFinancialMetrics(domains, transactions);
  }, [domains, transactions]);
}

// 域名表现计算hook
export function useDomainPerformance(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): DomainPerformance[] {
  return useMemo(() => {
    return calculateDomainPerformance(domains, transactions);
  }, [domains, transactions]);
}

// 月度收益计算hook
export function useMonthlyReturns(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): number[] {
  return useMemo(() => {
    return calculateMonthlyReturns(domains, transactions);
  }, [domains, transactions]);
}

// 风险分析hook
export function useRiskAnalysis(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
) {
  return useMemo(() => {
    const monthlyReturns = calculateMonthlyReturns(domains, transactions);
    const volatility = calculateVolatility(monthlyReturns);
    const maxDrawdown = calculateMaxDrawdown(monthlyReturns);
    const riskLevel = calculateRiskLevel(volatility, maxDrawdown);
    const successRate = calculateSuccessRate(domains);

    return {
      volatility: volatility * 100,
      maxDrawdown: maxDrawdown * 100,
      riskLevel,
      successRate,
      monthlyReturns
    };
  }, [domains, transactions]);
}

// 综合财务分析hook
export function useComprehensiveFinancialAnalysis(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
) {
  const basicMetrics = useBasicFinancialMetrics(domains, transactions);
  const advancedMetrics = useAdvancedFinancialMetrics(domains, transactions);
  const domainPerformance = useDomainPerformance(domains, transactions);
  const riskAnalysis = useRiskAnalysis(domains, transactions);

  return useMemo(() => ({
    basic: basicMetrics,
    advanced: advancedMetrics,
    domainPerformance,
    risk: riskAnalysis
  }), [basicMetrics, advancedMetrics, domainPerformance, riskAnalysis]);
}
