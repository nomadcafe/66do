import { useMemo } from 'react';
import { Domain, DomainTransaction as Transaction } from '../types/domain';
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
  domains: Domain[],
  transactions: Transaction[]
): BasicFinancialMetrics {
  return useMemo(() => {
    return calculateBasicFinancialMetrics(domains, transactions);
  }, [domains, transactions]);
}

// 高级财务计算hook
export function useAdvancedFinancialMetrics(
  domains: Domain[],
  transactions: Transaction[]
): AdvancedFinancialMetrics {
  return useMemo(() => {
    return calculateAdvancedFinancialMetrics(domains, transactions);
  }, [domains, transactions]);
}

// 域名表现计算hook
export function useDomainPerformance(
  domains: Domain[],
  transactions: Transaction[]
): DomainPerformance[] {
  return useMemo(() => {
    return calculateDomainPerformance(domains, transactions);
  }, [domains, transactions]);
}

// 月度收益计算hook
export function useMonthlyReturns(
  domains: Domain[],
  transactions: Transaction[]
): number[] {
  return useMemo(() => {
    return calculateMonthlyReturns(domains, transactions);
  }, [domains, transactions]);
}

// 风险分析hook
export function useRiskAnalysis(
  domains: Domain[],
  transactions: Transaction[]
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
  domains: Domain[],
  transactions: Transaction[]
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
