// 财务计算工具函数
export interface FinancialCalculation {
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  exchangeRate: number;
  baseAmount: number;
  taxDeductible: boolean;
}

// 计算平台手续费
export function calculatePlatformFee(
  amount: number, 
  feePercentage: number = 0
): number {
  return amount * (feePercentage / 100);
}

// 计算净收入
export function calculateNetAmount(
  amount: number, 
  platformFee: number = 0
): number {
  return amount - platformFee;
}

// 汇率转换
export function convertCurrency(
  amount: number, 
  exchangeRate: number = 1
): number {
  return amount * exchangeRate;
}

// 计算总成本（包含手续费）
export function calculateTotalCost(
  baseAmount: number,
  platformFee: number = 0,
  exchangeRate: number = 1
): number {
  const convertedAmount = convertCurrency(baseAmount, exchangeRate);
  return convertedAmount + platformFee;
}

// 计算ROI（投资回报率）
export function calculateROI(
  totalInvestment: number,
  totalRevenue: number
): number {
  if (totalInvestment === 0) return 0;
  return ((totalRevenue - totalInvestment) / totalInvestment) * 100;
}

/**
 * 计算单个域名的 ROI（Domain Portfolio 表格/卡片使用）
 * 公式：ROI = (净收入 - 总持有成本) / 总持有成本 × 100
 * - 总持有成本 = 购买成本(purchase_cost) + 续费次数(renewal_count) × 单次续费(renewal_cost)
 * - 已出售：净收入 = 售价(sale_price) - 平台手续费(platform_fee)
 * - 过期：视为 -100%
 * - 持有中且有预估价值：净收入用 estimated_value 代入
 */
export function calculateDomainROI(
  domain: {
    purchase_cost?: number | null;
    renewal_cost?: number | null;
    renewal_count: number;
    status: string;
    sale_price?: number | null;
    platform_fee?: number | null;
    estimated_value?: number | null;
    expiry_date?: string | null;
  }
): number {
  const purchaseCost = domain.purchase_cost || 0;
  const renewalCost = domain.renewal_count * (domain.renewal_cost || 0);
  const totalHoldingCost = purchaseCost + renewalCost;

  if (totalHoldingCost === 0) return 0;

  // 已出售：净收入 = 售价 - 平台费（售价为空或 0 时按 0 收入，即 -100%）
  if (domain.status === 'sold') {
    const netRevenue = (domain.sale_price ?? 0) - (domain.platform_fee || 0);
    return ((netRevenue - totalHoldingCost) / totalHoldingCost) * 100;
  }

  if (domain.status === 'expired') return -100;

  if (domain.expiry_date) {
    const now = new Date();
    const expiryDate = new Date(domain.expiry_date);
    if (!isNaN(expiryDate.getTime()) && expiryDate < now) return -100;
  }

  if (domain.estimated_value != null && domain.estimated_value > 0) {
    return ((domain.estimated_value - totalHoldingCost) / totalHoldingCost) * 100;
  }

  return 0;
}

// 计算利润率
export function calculateProfitMargin(
  revenue: number,
  cost: number
): number {
  if (revenue === 0) return 0;
  return ((revenue - cost) / revenue) * 100;
}

// 计算年度化收益率
export function calculateAnnualizedReturn(
  initialInvestment: number,
  finalValue: number,
  years: number
): number {
  if (initialInvestment === 0 || years === 0) return 0;
  const totalReturn = (finalValue - initialInvestment) / initialInvestment;
  return Math.pow(1 + totalReturn, 1 / years) - 1;
}

// 计算域名持有成本
export function calculateDomainHoldingCost(
  purchaseCost: number,
  renewalCost: number,
  renewalCount: number,
  additionalFees: number = 0
): number {
  return purchaseCost + (renewalCost * renewalCount) + additionalFees;
}

// 计算域名净价值
export function calculateDomainNetValue(
  estimatedValue: number,
  holdingCost: number,
  platformFee: number = 0
): number {
  return estimatedValue - holdingCost - platformFee;
}

// 格式化货币
export function formatCurrency(
  amount: number, 
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(amount);
}

// 格式化百分比
export function formatPercentage(
  value: number,
  decimals: number = 2
): string {
  return `${value.toFixed(decimals)}%`;
}

// 计算税务影响
export function calculateTaxImpact(
  amount: number,
  taxRate: number = 0,
  isDeductible: boolean = false
): number {
  if (isDeductible) {
    return amount * (taxRate / 100);
  }
  return 0;
}

// 计算复利
export function calculateCompoundInterest(
  principal: number,
  rate: number,
  time: number,
  compoundFrequency: number = 1
): number {
  return principal * Math.pow(1 + (rate / compoundFrequency), compoundFrequency * time);
}

// 计算现值
export function calculatePresentValue(
  futureValue: number,
  discountRate: number,
  time: number
): number {
  return futureValue / Math.pow(1 + discountRate, time);
}

// 计算净现值
export function calculateNPV(
  cashFlows: number[],
  discountRate: number
): number {
  return cashFlows.reduce((npv, cashFlow, index) => {
    return npv + (cashFlow / Math.pow(1 + discountRate, index));
  }, 0);
}

// 计算内部收益率（简化版）
export function calculateIRR(
  cashFlows: number[],
  guess: number = 0.1
): number {
  const maxIterations = 100;
  const tolerance = 0.0001;
  
  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    const npv = calculateNPV(cashFlows, rate);
    
    if (Math.abs(npv) < tolerance) {
      return rate;
    }
    
    // 简化的牛顿法
    const derivative = cashFlows.reduce((sum, cashFlow, index) => {
      return sum - (index * cashFlow / Math.pow(1 + rate, index + 1));
    }, 0);
    
    rate = rate - npv / derivative;
  }
  
  return rate;
}

// 计算风险调整后收益
export function calculateRiskAdjustedReturn(
  returnRate: number,
  risk: number
): number {
  if (risk === 0) return returnRate;
  return returnRate / risk;
}

// 计算夏普比率
export function calculateSharpeRatio(
  portfolioReturn: number,
  riskFreeRate: number,
  portfolioRisk: number
): number {
  if (portfolioRisk === 0) return 0;
  return (portfolioReturn - riskFreeRate) / portfolioRisk;
}

// 计算最大回撤
export function calculateMaxDrawdown(values: number[]): number {
  if (values.length === 0) return 0;
  
  let maxValue = values[0];
  let maxDrawdown = 0;
  
  for (const value of values) {
    if (value > maxValue) {
      maxValue = value;
    }
    
    const drawdown = (maxValue - value) / maxValue;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

// 计算波动率
export function calculateVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  
  const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1);
  
  return Math.sqrt(variance);
}

// 计算相关性
export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
  const sumY2 = y.reduce((sum, val) => sum + val * val, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * 过期域名损失口径（与续费持有成本一致）：
 * - 损失金额 = 购买成本 + renewal_count × renewal_cost（已发生续费成本）
 * - 视为全额冲销：未扣减任何售出/回款；若曾部分出售需在交易层单独体现
 * - 无 expiry_date 但 status=expired 时，仍计入列表；年度归桶优先用 purchase_date 年，否则归入 unknown
 */
// 过期域名损失分析接口
export interface ExpiredDomainLoss {
  totalLoss: number;
  annualLoss: { [year: string]: number };
  expiredDomains: Array<{
    id: string;
    domain_name: string;
    totalInvestment: number;
    /** 到期日；null 表示未填 expiry_date */
    expiryDate: string | null;
    /** 用于年度汇总：到期年，或购买年，或 unknown */
    lossYear: string;
  }>;
  lossByYear: Array<{
    year: string;
    loss: number;
    domainCount: number;
  }>;
}

// 计算过期域名损失
export function calculateExpiredDomainLoss(
  domains: Array<{
    id: string;
    domain_name: string;
    purchase_cost?: number | null;
    renewal_cost?: number | null;
    renewal_count: number;
    status: string;
    expiry_date?: string | null;
    purchase_date?: string | null;
  }>
): ExpiredDomainLoss {
  const now = new Date();
  const expiredDomains: ExpiredDomainLoss['expiredDomains'] = [];
  const annualLoss: { [year: string]: number } = {};
  let totalLoss = 0;

  domains.forEach(domain => {
    // 检查域名是否过期
    let isExpired = false;
    let expiryDate: Date | null = null;
    const expiryDateStr: string | null = domain.expiry_date ?? null;

    if (domain.status === 'expired') {
      isExpired = true;
      if (domain.expiry_date) {
        expiryDate = new Date(domain.expiry_date);
      }
    } else if (domain.expiry_date) {
      expiryDate = new Date(domain.expiry_date);
      isExpired = expiryDate < now && domain.status !== 'sold';
    }

    // 无 expiry_date 但已标记 expired：仍计入（损失按持有成本全额计）
    if (!isExpired) return;

    const purchaseCost = domain.purchase_cost || 0;
    const renewalCost = (domain.renewal_count ?? 0) * (domain.renewal_cost || 0);
    const totalInvestment = purchaseCost + renewalCost;

    if (totalInvestment <= 0) return;

    let lossYear: string;
    if (expiryDate) {
      lossYear = expiryDate.getFullYear().toString();
    } else if (domain.purchase_date) {
      lossYear = new Date(domain.purchase_date).getFullYear().toString();
    } else {
      lossYear = 'unknown';
    }

    expiredDomains.push({
      id: domain.id,
      domain_name: domain.domain_name,
      totalInvestment,
      expiryDate: expiryDateStr,
      lossYear
    });

    annualLoss[lossYear] = (annualLoss[lossYear] || 0) + totalInvestment;
    totalLoss += totalInvestment;
  });

  // 按年份排序
  const lossByYear = Object.entries(annualLoss)
    .map(([year, loss]) => ({
      year,
      loss,
      domainCount: expiredDomains.filter((d) => d.lossYear === year).length
    }))
    .sort((a, b) => {
      if (a.year === 'unknown') return 1;
      if (b.year === 'unknown') return -1;
      return parseInt(a.year, 10) - parseInt(b.year, 10);
    });

  return {
    totalLoss,
    annualLoss,
    expiredDomains,
    lossByYear
  };
}
