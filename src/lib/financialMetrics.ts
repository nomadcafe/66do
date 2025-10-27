// 财务指标计算工具
export interface FinancialMetrics {
  // 销售额相关
  totalSales: number;           // 总销售额（未扣除手续费）
  totalRevenue: number;         // 总收入（扣除手续费后）
  totalPlatformFees: number;    // 总平台手续费
  
  // 成本相关
  totalInvestment: number;       // 总投资（购买成本）
  totalRenewalCost: number;     // 总续费成本
  totalHoldingCost: number;     // 总持有成本
  
  // 利润相关
  totalProfit: number;          // 总利润
  grossProfit: number;          // 毛利润（销售额 - 投资成本）
  netProfit: number;            // 净利润（净收入 - 总成本）
  
  // 年度指标
  annualSales: number;          // 年度销售额
  annualRevenue: number;        // 年度净收入
  annualProfit: number;         // 年度利润
  
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

export interface TransactionAnalysis {
  salesTransactions: Array<{
    id: string;
    domain_id: string;
    grossAmount: number;        // 总销售额
    platformFee: number;        // 平台手续费
    netAmount: number;           // 净收入
    date: string;
    platform?: string;
  }>;
  
  costTransactions: Array<{
    id: string;
    domain_id: string;
    amount: number;
    type: string;
    date: string;
  }>;
  
  totalPlatformFees: number;
  totalSales: number;
  totalRevenue: number;
}

// 分析交易记录
export function analyzeTransactions(transactions: Array<{
  id: string;
  domain_id: string;
  type: string;
  amount: number;
  platform_fee?: number;
  net_amount?: number;
  date: string;
  platform?: string;
}>): TransactionAnalysis {
  
  const salesTransactions = transactions
    .filter(t => t.type === 'sell' || t.type === 'installment_payment')
    .map(t => {
      const grossAmount = t.amount;
      const platformFee = t.platform_fee || 0;
      const netAmount = t.net_amount || (grossAmount - platformFee);
      
      return {
        id: t.id,
        domain_id: t.domain_id,
        grossAmount,
        platformFee,
        netAmount,
        date: t.date,
        platform: t.platform
      };
    });
  
  const costTransactions = transactions
    .filter(t => t.type === 'buy' || t.type === 'renew' || t.type === 'fee')
    .map(t => ({
      id: t.id,
      domain_id: t.domain_id,
      amount: t.amount,
      type: t.type,
      date: t.date
    }));
  
  const totalPlatformFees = salesTransactions.reduce((sum, t) => sum + t.platformFee, 0);
  const totalSales = salesTransactions.reduce((sum, t) => sum + t.grossAmount, 0);
  const totalRevenue = salesTransactions.reduce((sum, t) => sum + t.netAmount, 0);
  
  return {
    salesTransactions,
    costTransactions,
    totalPlatformFees,
    totalSales,
    totalRevenue
  };
}

// 计算年度指标
export function calculateAnnualMetrics(
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    platform_fee?: number;
    net_amount?: number;
    date: string;
  }>,
  year: number = new Date().getFullYear()
): {
  annualSales: number;
  annualRevenue: number;
  annualProfit: number;
  annualPlatformFees: number;
} {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  
  const yearTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate >= yearStart && transactionDate <= yearEnd;
  });
  
  const salesTransactions = yearTransactions.filter(t => t.type === 'sell' || t.type === 'installment_payment');
  const costTransactions = yearTransactions.filter(t => 
    t.type === 'buy' || t.type === 'renew' || t.type === 'fee'
  );
  
  const annualSales = salesTransactions.reduce((sum, t) => sum + t.amount, 0);
  const annualPlatformFees = salesTransactions.reduce((sum, t) => sum + (t.platform_fee || 0), 0);
  const annualRevenue = salesTransactions.reduce((sum, t) => sum + (t.net_amount || t.amount), 0);
  const annualCosts = costTransactions.reduce((sum, t) => sum + t.amount, 0);
  const annualProfit = annualRevenue - annualCosts;
  
  return {
    annualSales,
    annualRevenue,
    annualProfit,
    annualPlatformFees
  };
}

// 计算完整财务指标
export function calculateFinancialMetrics(
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
    platform_fee?: number;
    net_amount?: number;
    date: string;
    platform?: string;
  }>
): FinancialMetrics {
  
  // 分析交易记录
  const transactionAnalysis = analyzeTransactions(transactions);
  
  // 计算投资成本
  const totalInvestment = domains.reduce((sum, domain) => sum + domain.purchase_cost, 0);
  const totalRenewalCost = domains.reduce((sum, domain) => 
    sum + (domain.renewal_count * domain.renewal_cost), 0
  );
  const totalHoldingCost = totalInvestment + totalRenewalCost;
  
  // 销售额和收入
  const totalSales = transactionAnalysis.totalSales;
  const totalRevenue = transactionAnalysis.totalRevenue;
  const totalPlatformFees = transactionAnalysis.totalPlatformFees;
  
  // 利润计算
  const totalProfit = totalRevenue - totalHoldingCost;
  const grossProfit = totalSales - totalInvestment; // 毛利润（未扣除续费成本）
  const netProfit = totalRevenue - totalHoldingCost; // 净利润
  
  // 年度指标
  const currentYear = new Date().getFullYear();
  const annualMetrics = calculateAnnualMetrics(transactions, currentYear);
  
  // 域名统计
  const totalDomains = domains.length;
  const activeDomains = domains.filter(d => d.status === 'active').length;
  const soldDomains = domains.filter(d => d.status === 'sold').length;
  
  // 平均价格
  const avgPurchasePrice = totalDomains > 0 ? totalInvestment / totalDomains : 0;
  const avgSalePrice = soldDomains > 0 ? totalSales / soldDomains : 0;
  
  // 比率计算
  const roi = totalHoldingCost > 0 ? (totalProfit / totalHoldingCost) * 100 : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const grossMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
  
  return {
    // 销售额相关
    totalSales,
    totalRevenue,
    totalPlatformFees,
    
    // 成本相关
    totalInvestment,
    totalRenewalCost,
    totalHoldingCost,
    
    // 利润相关
    totalProfit,
    grossProfit,
    netProfit,
    
    // 年度指标
    annualSales: annualMetrics.annualSales,
    annualRevenue: annualMetrics.annualRevenue,
    annualProfit: annualMetrics.annualProfit,
    
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

// 计算域名表现
export function calculateDomainPerformance(
  domain: {
    id: string;
    domain_name: string;
    purchase_cost: number;
    renewal_cost: number;
    renewal_count: number;
    purchase_date: string;
    status: string;
  },
  transactions: Array<{
    domain_id: string;
    type: string;
    amount: number;
    platform_fee?: number;
    net_amount?: number;
    date: string;
  }>
): {
  domainName: string;
  totalInvestment: number;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  roi: number;
  holdingPeriod: number;
  status: string;
} {
  
  const domainTransactions = transactions.filter(t => t.domain_id === domain.id);
  
  // 投资成本
  const purchaseCost = domain.purchase_cost;
  const renewalCost = domain.renewal_count * domain.renewal_cost;
  const totalInvestment = purchaseCost + renewalCost;
  
  // 销售收入
  const salesTransactions = domainTransactions.filter(t => t.type === 'sell');
  const totalSales = salesTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalRevenue = salesTransactions.reduce((sum, t) => sum + (t.net_amount || t.amount), 0);
  
  // 利润和ROI
  const totalProfit = totalRevenue - totalInvestment;
  const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
  
  // 持有期
  const purchaseDate = new Date(domain.purchase_date);
  const currentDate = new Date();
  const holdingPeriod = Math.floor((currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    domainName: domain.domain_name,
    totalInvestment,
    totalSales,
    totalRevenue,
    totalProfit,
    roi,
    holdingPeriod,
    status: domain.status
  };
}
