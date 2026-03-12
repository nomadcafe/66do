// import { Domain, DomainTransaction as Transaction } from '../types/domain';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';

/** 统一以 USD 计价的交易金额（优先 base_amount，用于汇总） */
function amountUSD(t: TransactionWithRequiredFields): number {
  if (t.base_amount != null && t.base_amount !== undefined) return t.base_amount;
  return t.net_amount != null && t.net_amount !== undefined ? t.net_amount : t.amount;
}

// 基础财务计算接口
export interface BasicFinancialMetrics {
  totalInvestment: number;
  totalRevenue: number;
  totalProfit: number;
  roi: number;
  profitMargin: number;
}

// 域名表现接口
export interface DomainPerformance {
  domain: DomainWithTags;
  profit: number;
  roi: number;
  totalCost: number;
  revenue: number;
}

// 高级财务指标接口
export interface AdvancedFinancialMetrics extends BasicFinancialMetrics {
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  avgHoldingPeriod: number;
  bestPerformingDomain: string;
  worstPerformingDomain: string;
}

/**
 * 域名持有成本（仅已发生）：购买成本 + 已续费次数 × 单次续费成本。
 * 不含未来计划续费；若后续需「预估总持有成本」，可基于 next_renewal_date 扩展。
 */
export function calculateDomainHoldingCost(
  purchaseCost: number,
  renewalCost: number,
  renewalCount: number
): number {
  return purchaseCost + (renewalCount * renewalCost);
}

// 计算基础财务指标
export function calculateBasicFinancialMetrics(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): BasicFinancialMetrics {
  const totalInvestment = domains.reduce((sum, domain) => {
    return sum + calculateDomainHoldingCost(
      domain.purchase_cost || 0,
      domain.renewal_cost || 0,
      domain.renewal_count ?? 0
    );
  }, 0);

  const totalRevenue = transactions
    .filter(t => t.type === 'sell')
    .reduce((sum, t) => sum + amountUSD(t), 0);

  const totalProfit = totalRevenue - totalInvestment;
  const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    totalInvestment,
    totalRevenue,
    totalProfit,
    roi,
    profitMargin
  };
}

// 计算域名表现
export function calculateDomainPerformance(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): DomainPerformance[] {
  return domains.map(domain => {
    const totalCost = calculateDomainHoldingCost(
      domain.purchase_cost || 0,
      domain.renewal_cost || 0,
      domain.renewal_count ?? 0
    );
    
    const domainTransactions = transactions.filter(t => t.domain_id === domain.id);
    
    const totalEarned = domainTransactions
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + amountUSD(t), 0);
    
    const revenue = domain.sale_price || domain.estimated_value || totalEarned;
    const profit = revenue - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return {
      domain,
      profit,
      roi,
      totalCost,
      revenue
    };
  });
}

// 计算年化收益率
export function calculateAnnualizedReturn(
  totalInvestment: number,
  totalRevenue: number,
  years: number
): number {
  if (years <= 0 || totalInvestment <= 0) return 0;
  
  const totalReturn = (totalRevenue - totalInvestment) / totalInvestment;
  return Math.pow(1 + totalReturn, 1 / years) - 1;
}

// 计算投资年限
export function calculateInvestmentYears(domains: DomainWithTags[]): number {
  if (domains.length === 0) return 1;
  
  const oldestDomain = domains.reduce((oldest, domain) => {
    const domainDate = new Date(domain.purchase_date || '');
    const oldestDate = new Date(oldest.purchase_date || '');
    return domainDate < oldestDate ? domain : oldest;
  }, domains[0]);
  
  if (!oldestDomain) return 1;
  
  return (new Date().getTime() - new Date(oldestDomain.purchase_date || '').getTime()) / (1000 * 60 * 60 * 24 * 365);
}

/** 月度收益率（%）：每月出售收入 / 当月累计投资成本 */
export function calculateMonthlyReturns(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): number[] {
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - i));
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const monthDomains = domains.filter(d => {
      const domainMonth = (d.purchase_date || '').slice(0, 7);
      return domainMonth <= monthKey;
    });
    const investment = monthDomains.reduce(
      (sum, d) => sum + calculateDomainHoldingCost(d.purchase_cost || 0, d.renewal_cost || 0, d.renewal_count ?? 0),
      0
    );

    const monthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === date.getMonth() &&
             transactionDate.getFullYear() === date.getFullYear() && t.type === 'sell';
    });
    const revenue = monthTransactions.reduce((sum, t) => sum + amountUSD(t), 0);

    if (investment <= 0) return 0;
    return (revenue / investment) * 100;
  });
}

// 计算波动率
export function calculateVolatility(returns: number[]): number {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

/** 最大回撤（小数）：基于月度收益率序列的累计净值，从高点到低点的最大相对回撤 */
export function calculateMaxDrawdown(returns: number[]): number {
  if (returns.length === 0) return 0;
  let wealth = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (let i = 0; i < returns.length; i++) {
    wealth *= 1 + returns[i] / 100;
    if (wealth > peak) peak = wealth;
    const drawdown = peak > 0 ? (peak - wealth) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return maxDrawdown;
}

/** 夏普比率：年化收益率与年化波动率均为小数（如 0.05, 0.12） */
export function calculateSharpeRatio(
  annualizedReturnDecimal: number,
  riskFreeRate: number = 0.02,
  annualizedVolatilityDecimal: number
): number {
  if (annualizedVolatilityDecimal <= 0) return 0;
  return (annualizedReturnDecimal - riskFreeRate) / annualizedVolatilityDecimal;
}

// 计算胜率
export function calculateWinRate(domains: DomainWithTags[]): number {
  const soldDomains = domains.filter(d => d.status === 'sold');
  if (soldDomains.length === 0) return 0;
  
  const profitableDomains = soldDomains.filter(d => {
    const totalCost = calculateDomainHoldingCost(
      d.purchase_cost || 0,
      d.renewal_cost || 0,
      d.renewal_count ?? 0
    );
    return (d.sale_price || 0) > totalCost;
  });
  
  return (profitableDomains.length / soldDomains.length) * 100;
}

// 计算平均持有期
export function calculateAvgHoldingPeriod(domains: DomainWithTags[]): number {
  const soldDomains = domains.filter(d => d.status === 'sold');
  if (soldDomains.length === 0) return 0;
  
  const totalDays = soldDomains.reduce((sum, domain) => {
    const purchaseDate = new Date(domain.purchase_date || '');
    const saleDate = new Date(domain.sale_date || domain.purchase_date || '');
    return sum + (saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
  }, 0);
  
  return totalDays / soldDomains.length;
}

// 计算高级财务指标
export function calculateAdvancedFinancialMetrics(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
): AdvancedFinancialMetrics {
  const basicMetrics = calculateBasicFinancialMetrics(domains, transactions);
  const years = calculateInvestmentYears(domains);
  const annualizedReturn = calculateAnnualizedReturn(
    basicMetrics.totalInvestment,
    basicMetrics.totalRevenue,
    years
  );
  
  const monthlyReturnPct = calculateMonthlyReturns(domains, transactions);
  const volMonthlyPct = calculateVolatility(monthlyReturnPct);
  const volAnnualDecimal = (volMonthlyPct / 100) * Math.sqrt(12);
  const maxDrawdown = calculateMaxDrawdown(monthlyReturnPct);
  const sharpeRatio = calculateSharpeRatio(annualizedReturn, 0.02, volAnnualDecimal);
  
  const winRate = calculateWinRate(domains);
  const avgHoldingPeriod = calculateAvgHoldingPeriod(domains);
  
  const domainPerformance = calculateDomainPerformance(domains, transactions);
  const soldPerformance = domainPerformance.filter(p => p.domain.status === 'sold');
  const fallback = { domain: { domain_name: 'N/A' }, roi: 0 };
  const bestDomain = soldPerformance.length > 0
    ? soldPerformance.reduce((best, current) => (current.roi > best.roi ? current : best), soldPerformance[0])
    : fallback;
  const worstDomain = soldPerformance.length > 0
    ? soldPerformance.reduce((worst, current) => (current.roi < worst.roi ? current : worst), soldPerformance[0])
    : fallback;

  return {
    ...basicMetrics,
    annualizedReturn: annualizedReturn * 100,
    sharpeRatio,
    maxDrawdown: maxDrawdown * 100,
    volatility: volAnnualDecimal * 100,
    winRate,
    avgHoldingPeriod,
    bestPerformingDomain: bestDomain.domain.domain_name,
    worstPerformingDomain: worstDomain.domain.domain_name
  };
}

/** 风险等级：volatility 为年化波动率（小数），maxDrawdown 为小数 */
export function calculateRiskLevel(
  volatilityDecimal: number,
  maxDrawdownDecimal: number
): 'Low' | 'Medium' | 'High' {
  if (volatilityDecimal > 0.3 || maxDrawdownDecimal > 0.5) return 'High';
  if (volatilityDecimal > 0.15 || maxDrawdownDecimal > 0.2) return 'Medium';
  return 'Low';
}

// 计算成功率
export function calculateSuccessRate(domains: DomainWithTags[]): number {
  const soldDomains = domains.filter(d => d.status === 'sold');
  return domains.length > 0 ? (soldDomains.length / domains.length) * 100 : 0;
}
