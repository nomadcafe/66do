// 增强的财务指标计算工具
export interface EnhancedFinancialMetrics {
  // 收入相关（更清晰的命名）
  totalSales: number;           // 总销售额（未扣除任何费用）
  totalNetRevenue: number;      // 净收入（扣除手续费后）
  totalPlatformFees: number;    // 总平台手续费
  
  // 成本相关
  totalInvestment: number;      // 总投资（购买成本）
  totalRenewalCost: number;     // 总续费成本
  totalHoldingCost: number;     // 总持有成本
  
  // 利润相关（更清晰的命名）
  grossProfit: number;          // 毛利润（净收入 - 投资成本）
  netProfit: number;            // 净利润（净收入 - 总持有成本）
  
  // 年度指标
  annualSales: number;          // 年度销售额
  annualNetRevenue: number;     // 年度净收入
  annualProfit: number;         // 年度净利润
  
  // 比率指标
  roi: number;                  // 投资回报率
  profitMargin: number;         // 利润率
  grossMargin: number;          // 毛利率
  
  // 域名统计
  totalDomains: number;
  activeDomains: number;
  soldDomains: number;
  avgSalePrice: number;
  avgPurchasePrice: number;
}

export interface DomainROI {
  domainId: string;
  domainName: string;
  totalInvestment: number;      // 总投资（购买+续费）
  totalSales: number;          // 总销售额
  netRevenue: number;          // 净收入（扣除手续费）
  grossProfit: number;          // 毛利润（净收入-投资成本）
  roi: number;                 // ROI百分比
  holdingPeriod: number;        // 持有天数
  status: string;
  saleDate?: string;
}

// 计算单个域名的ROI
export function calculateDomainROI(
  domain: {
    id: string;
    domain_name: string;
    purchase_cost: number | null;
    renewal_cost: number | null;
    renewal_count: number;
    purchase_date: string | null;
    status: string;
    expiry_date?: string | null;
  },
  transactions: Array<{
    domain_id: string;
    type: string;
    amount: number;
    platform_fee?: number | null;
    net_amount?: number | null;
    date: string;
  }>
): DomainROI {
  
  const domainTransactions = transactions.filter(t => t.domain_id === domain.id);
  
  // 投资成本
  const purchaseCost = domain.purchase_cost || 0;
  const renewalCost = domain.renewal_count * (domain.renewal_cost || 0);
  const totalInvestment = purchaseCost + renewalCost;
  
  // 销售收入
  const salesTransactions = domainTransactions.filter(t => t.type === 'sell' || t.type === 'installment_payment');
  const totalSales = salesTransactions.reduce((sum, t) => sum + t.amount, 0);
  const netRevenue = salesTransactions.reduce((sum, t) => sum + (t.net_amount || t.amount), 0);
  
  // 检查域名是否过期
  let isExpired = false;
  if (domain.status === 'expired') {
    isExpired = true;
  } else if (domain.expiry_date) {
    const now = new Date();
    const expiryDate = new Date(domain.expiry_date);
    isExpired = expiryDate < now && domain.status !== 'sold';
  }
  
  // 利润和ROI
  let grossProfit: number;
  let roi: number;
  
  if (isExpired) {
    // 过期域名：100%损失
    grossProfit = -totalInvestment;
    roi = -100;
  } else {
    // 正常计算
    grossProfit = netRevenue - totalInvestment;
    roi = totalInvestment > 0 ? (grossProfit / totalInvestment) * 100 : 0;
  }
  
  // 持有期
  const purchaseDate = new Date(domain.purchase_date || '');
  const currentDate = new Date();
  const holdingPeriod = Math.floor((currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // 销售日期
  const saleDate = salesTransactions.length > 0 ? salesTransactions[0].date : undefined;
  
  return {
    domainId: domain.id,
    domainName: domain.domain_name,
    totalInvestment,
    totalSales,
    netRevenue,
    grossProfit,
    roi,
    holdingPeriod,
    status: domain.status,
    saleDate
  };
}

// 计算所有域名的ROI
export function calculateAllDomainROIs(
  domains: Array<{
    id: string;
    domain_name: string;
    purchase_cost: number;
    renewal_cost: number;
    renewal_count: number;
    purchase_date: string;
    status: string;
    expiry_date?: string | null;
  }>,
  transactions: Array<{
    domain_id: string;
    type: string;
    amount: number;
    platform_fee?: number | null;
    net_amount?: number | null;
    date: string;
  }>
): DomainROI[] {
  return domains.map(domain => calculateDomainROI(domain, transactions));
}

// 计算增强的财务指标
export function calculateEnhancedFinancialMetrics(
  domains: Array<{
    id: string;
    purchase_cost: number;
    renewal_cost: number;
    renewal_count: number;
    status: string;
    purchase_date: string;
  }>,
  transactions: Array<{
    id: string;
    domain_id: string;
    type: string;
    amount: number;
    platform_fee?: number | null;
    net_amount?: number | null;
    date: string;
    platform?: string;
  }>
): EnhancedFinancialMetrics {
  
  // 分析交易记录
  const salesTransactions = transactions.filter(t => t.type === 'sell' || t.type === 'installment_payment');
  const totalSales = salesTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalPlatformFees = salesTransactions.reduce((sum, t) => sum + (t.platform_fee || 0), 0);
  const totalNetRevenue = salesTransactions.reduce((sum, t) => sum + (t.net_amount || t.amount), 0);
  
  // 计算投资成本
  const totalInvestment = domains.reduce((sum, domain) => sum + domain.purchase_cost, 0);
  const totalRenewalCost = domains.reduce((sum, domain) => 
    sum + (domain.renewal_count * domain.renewal_cost), 0
  );
  const totalHoldingCost = totalInvestment + totalRenewalCost;
  
  // 利润计算
  const grossProfit = totalNetRevenue - totalInvestment; // 毛利润（净收入 - 投资成本）
  const netProfit = totalNetRevenue - totalHoldingCost;   // 净利润（净收入 - 总持有成本）
  
  // 年度指标
  const currentYear = new Date().getFullYear();
  const yearTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate.getFullYear() === currentYear;
  });
  
  const yearSalesTransactions = yearTransactions.filter(t => t.type === 'sell' || t.type === 'installment_payment');
  const annualSales = yearSalesTransactions.reduce((sum, t) => sum + t.amount, 0);
  const annualNetRevenue = yearSalesTransactions.reduce((sum, t) => sum + (t.net_amount || t.amount), 0);
  const annualProfit = annualNetRevenue - totalHoldingCost; // 这里需要更精确的计算
  
  // 域名统计
  const totalDomains = domains.length;
  const activeDomains = domains.filter(d => d.status === 'active').length;
  const soldDomains = domains.filter(d => d.status === 'sold').length;
  
  // 平均价格
  const avgPurchasePrice = totalDomains > 0 ? totalInvestment / totalDomains : 0;
  const avgSalePrice = soldDomains > 0 ? totalSales / soldDomains : 0;
  
  // 比率计算
  const roi = totalHoldingCost > 0 ? (netProfit / totalHoldingCost) * 100 : 0;
  const profitMargin = totalNetRevenue > 0 ? (netProfit / totalNetRevenue) * 100 : 0;
  const grossMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
  
  return {
    // 收入相关
    totalSales,
    totalNetRevenue,
    totalPlatformFees,
    
    // 成本相关
    totalInvestment,
    totalRenewalCost,
    totalHoldingCost,
    
    // 利润相关
    grossProfit,
    netProfit,
    
    // 年度指标
    annualSales,
    annualNetRevenue,
    annualProfit,
    
    // 比率指标
    roi,
    profitMargin,
    grossMargin,
    
    // 域名统计
    totalDomains,
    activeDomains,
    soldDomains,
    avgSalePrice,
    avgPurchasePrice
  };
}

// 格式化货币
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

// 格式化百分比
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

// 获取ROI颜色
export function getROIColor(roi: number): string {
  if (roi > 50) return 'text-green-600';
  if (roi > 0) return 'text-blue-600';
  if (roi > -20) return 'text-yellow-600';
  return 'text-red-600';
}

// 获取ROI背景色
export function getROIBgColor(roi: number): string {
  if (roi > 50) return 'bg-green-100';
  if (roi > 0) return 'bg-blue-100';
  if (roi > -20) return 'bg-yellow-100';
  return 'bg-red-100';
}
