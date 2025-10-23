import { Domain, DomainTransaction as Transaction } from '../types/domain';

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
  domain: Domain;
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

// 计算域名持有成本
export function calculateDomainHoldingCost(
  purchaseCost: number,
  renewalCost: number,
  renewalCount: number
): number {
  return purchaseCost + (renewalCount * renewalCost);
}

// 计算基础财务指标
export function calculateBasicFinancialMetrics(
  domains: Domain[],
  transactions: Transaction[]
): BasicFinancialMetrics {
  const totalInvestment = domains.reduce((sum, domain) => {
    return sum + calculateDomainHoldingCost(
      domain.purchase_cost,
      domain.renewal_cost,
      domain.renewal_count
    );
  }, 0);

  const totalRevenue = transactions
    .filter(t => t.type === 'sell')
    .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);

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
  domains: Domain[],
  transactions: Transaction[]
): DomainPerformance[] {
  return domains.map(domain => {
    const totalCost = calculateDomainHoldingCost(
      domain.purchase_cost,
      domain.renewal_cost,
      domain.renewal_count
    );
    
    const domainTransactions = transactions.filter(t => t.domain_id === domain.id);
    
    const totalEarned = domainTransactions
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);
    
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
export function calculateInvestmentYears(domains: Domain[]): number {
  if (domains.length === 0) return 1;
  
  const oldestDomain = domains.reduce((oldest, domain) => {
    const domainDate = new Date(domain.purchase_date);
    const oldestDate = new Date(oldest.purchase_date);
    return domainDate < oldestDate ? domain : oldest;
  }, domains[0]);
  
  if (!oldestDomain) return 1;
  
  return (new Date().getTime() - new Date(oldestDomain.purchase_date).getTime()) / (1000 * 60 * 60 * 24 * 365);
}

// 计算月度收益
export function calculateMonthlyReturns(
  domains: Domain[],
  transactions: Transaction[]
): number[] {
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - i));
    
    const monthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === date.getMonth() && 
             transactionDate.getFullYear() === date.getFullYear();
    });
    
    return monthTransactions
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);
  });
}

// 计算波动率
export function calculateVolatility(returns: number[]): number {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

// 计算最大回撤
export function calculateMaxDrawdown(returns: number[]): number {
  if (returns.length === 0) return 0;
  
  let maxDrawdown = 0;
  let peak = returns[0];
  
  for (let i = 1; i < returns.length; i++) {
    if (returns[i] > peak) {
      peak = returns[i];
    } else {
      const drawdown = (peak - returns[i]) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }
  
  return maxDrawdown;
}

// 计算夏普比率
export function calculateSharpeRatio(
  annualizedReturn: number,
  riskFreeRate: number = 0.02,
  volatility: number
): number {
  if (volatility === 0) return 0;
  return (annualizedReturn - riskFreeRate) / volatility;
}

// 计算胜率
export function calculateWinRate(domains: Domain[]): number {
  const soldDomains = domains.filter(d => d.status === 'sold');
  if (soldDomains.length === 0) return 0;
  
  const profitableDomains = soldDomains.filter(d => {
    const totalCost = calculateDomainHoldingCost(
      d.purchase_cost,
      d.renewal_cost,
      d.renewal_count
    );
    return (d.sale_price || 0) > totalCost;
  });
  
  return (profitableDomains.length / soldDomains.length) * 100;
}

// 计算平均持有期
export function calculateAvgHoldingPeriod(domains: Domain[]): number {
  const soldDomains = domains.filter(d => d.status === 'sold');
  if (soldDomains.length === 0) return 0;
  
  const totalDays = soldDomains.reduce((sum, domain) => {
    const purchaseDate = new Date(domain.purchase_date);
    const saleDate = new Date(domain.sale_date || domain.purchase_date);
    return sum + (saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
  }, 0);
  
  return totalDays / soldDomains.length;
}

// 计算高级财务指标
export function calculateAdvancedFinancialMetrics(
  domains: Domain[],
  transactions: Transaction[]
): AdvancedFinancialMetrics {
  const basicMetrics = calculateBasicFinancialMetrics(domains, transactions);
  const years = calculateInvestmentYears(domains);
  const annualizedReturn = calculateAnnualizedReturn(
    basicMetrics.totalInvestment,
    basicMetrics.totalRevenue,
    years
  );
  
  const monthlyReturns = calculateMonthlyReturns(domains, transactions);
  const volatility = calculateVolatility(monthlyReturns);
  const maxDrawdown = calculateMaxDrawdown(monthlyReturns);
  const sharpeRatio = calculateSharpeRatio(annualizedReturn, 0.02, volatility);
  
  const winRate = calculateWinRate(domains);
  const avgHoldingPeriod = calculateAvgHoldingPeriod(domains);
  
  const domainPerformance = calculateDomainPerformance(domains, transactions);
  const bestDomain = domainPerformance.reduce((best, current) => 
    current.roi > best.roi ? current : best, 
    domainPerformance[0] || { domain: { domain_name: 'N/A' }, roi: 0 }
  );
  
  const worstDomain = domainPerformance.reduce((worst, current) => 
    current.roi < worst.roi ? current : worst, 
    domainPerformance[0] || { domain: { domain_name: 'N/A' }, roi: 0 }
  );

  return {
    ...basicMetrics,
    annualizedReturn: annualizedReturn * 100,
    sharpeRatio,
    maxDrawdown: maxDrawdown * 100,
    volatility: volatility * 100,
    winRate,
    avgHoldingPeriod,
    bestPerformingDomain: bestDomain.domain.domain_name,
    worstPerformingDomain: worstDomain.domain.domain_name
  };
}

// 计算风险等级
export function calculateRiskLevel(
  volatility: number,
  maxDrawdown: number
): 'Low' | 'Medium' | 'High' {
  if (volatility > 0.3 || maxDrawdown > 0.5) return 'High';
  if (volatility > 0.15 || maxDrawdown > 0.2) return 'Medium';
  return 'Low';
}

// 计算成功率
export function calculateSuccessRate(domains: Domain[]): number {
  const soldDomains = domains.filter(d => d.status === 'sold');
  return domains.length > 0 ? (soldDomains.length / domains.length) * 100 : 0;
}
