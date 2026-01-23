import { useMemo } from 'react';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';
import { calculateEnhancedFinancialMetrics } from '../lib/enhancedFinancialMetrics';
import { calculateAnnualRenewalCost } from '../lib/renewalCalculations';

export interface DomainStats {
  totalDomains: number;
  totalInvestment: number;
  totalRevenue: number;
  totalProfit: number;
  roi: number;
  activeDomains: number;
  forSaleDomains: number;
  soldDomains: number;
  expiredDomains: number;
  avgPurchasePrice: number;
  avgSalePrice: number;
  bestPerformingDomain: string;
  worstPerformingDomain: string;
  totalRenewalCost: number;
  annualRenewalCost: number;
  totalHoldingCost: number;
  avgRenewalCost: number;
  renewalCycles: { [key: string]: number };
}

export function useDomainStats(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): DomainStats {
  // 计算续费分析
  const renewalAnalysis = useMemo(() => {
    const validDomains = domains
      .filter(domain =>
        domain.status === 'active' &&
        domain.renewal_cost !== null &&
        domain.purchase_date !== null
      )
      .map(domain => ({
        id: domain.id,
        domain_name: domain.domain_name,
        renewal_cost: domain.renewal_cost!,
        renewal_cycle: domain.renewal_cycle,
        renewal_count: domain.renewal_count,
        purchase_date: domain.purchase_date!,
        expiry_date: domain.expiry_date || undefined,
        status: domain.status
      }));

    return calculateAnnualRenewalCost(validDomains);
  }, [domains]);

  // 计算增强的财务指标
  const enhancedFinancialMetrics = useMemo(() => {
    const validDomains = domains
      .filter(domain =>
        domain.purchase_cost !== null &&
        domain.renewal_cost !== null &&
        domain.purchase_date !== null
      )
      .map(domain => ({
        id: domain.id,
        purchase_cost: domain.purchase_cost!,
        renewal_cost: domain.renewal_cost!,
        renewal_count: domain.renewal_count,
        status: domain.status,
        purchase_date: domain.purchase_date!
      }));

    const validTransactions = transactions
      .filter(transaction => transaction.amount !== null)
      .map(transaction => ({
        id: transaction.id,
        domain_id: transaction.domain_id,
        type: transaction.type,
        amount: transaction.amount!,
        platform_fee: transaction.platform_fee || undefined,
        net_amount: transaction.net_amount || undefined,
        date: transaction.date,
        platform: transaction.platform
      }));

    return calculateEnhancedFinancialMetrics(validDomains, validTransactions);
  }, [domains, transactions]);

  // 计算统计数据
  const stats = useMemo((): DomainStats => {
    const totalDomains = domains.length;
    const activeDomains = domains.filter(d => d.status === 'active').length;
    const forSaleDomains = domains.filter(d => d.status === 'for_sale').length;
    const soldDomains = domains.filter(d => d.status === 'sold').length;
    const expiredDomains = domains.filter(d => d.status === 'expired').length;

    const totalInvestment = enhancedFinancialMetrics.totalInvestment;
    const totalRevenue = enhancedFinancialMetrics.totalNetRevenue;
    const totalRenewalCost = enhancedFinancialMetrics.totalRenewalCost;
    const totalHoldingCost = enhancedFinancialMetrics.totalHoldingCost;
    const totalProfit = enhancedFinancialMetrics.netProfit;
    const roi = enhancedFinancialMetrics.roi;

    const avgPurchasePrice = totalDomains > 0 ? totalInvestment / totalDomains : 0;
    const avgSalePrice = soldDomains > 0 ? enhancedFinancialMetrics.avgSalePrice : 0;
    const avgRenewalCost = totalDomains > 0 ? totalRenewalCost / totalDomains : 0;

    // 计算最佳和最差表现的域名
    const soldDomainsList = domains.filter(d => d.status === 'sold');
    let bestPerformingDomain = '';
    let worstPerformingDomain = '';
    let bestProfit = -Infinity;
    let worstProfit = Infinity;

    soldDomainsList.forEach(domain => {
      const holdingCost = (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
      const profit = (domain.sale_price || 0) - holdingCost - (domain.platform_fee || 0);
      if (profit > bestProfit) {
        bestProfit = profit;
        bestPerformingDomain = domain.domain_name;
      }
      if (profit < worstProfit) {
        worstProfit = profit;
        worstPerformingDomain = domain.domain_name;
      }
    });

    // 计算续费周期分布
    const renewalCycles: { [key: string]: number } = {};
    domains.forEach(domain => {
      const cycle = domain.renewal_cycle.toString();
      renewalCycles[cycle] = (renewalCycles[cycle] || 0) + 1;
    });

    return {
      totalDomains,
      totalInvestment,
      totalRevenue,
      totalProfit,
      roi,
      activeDomains,
      forSaleDomains,
      soldDomains,
      expiredDomains,
      avgPurchasePrice,
      avgSalePrice,
      bestPerformingDomain,
      worstPerformingDomain,
      totalRenewalCost,
      annualRenewalCost: renewalAnalysis.totalAnnualCost,
      totalHoldingCost,
      avgRenewalCost,
      renewalCycles
    };
  }, [domains, enhancedFinancialMetrics, renewalAnalysis]);

  return stats;
}

