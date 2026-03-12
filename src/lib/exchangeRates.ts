// 汇率管理工具
export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  date: string;
  source: string;
}

export interface HistoricalRate {
  date: string;
  rates: Record<string, number>;
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

// 仅支持美元
export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: '美元', symbol: '$', flag: '🇺🇸' }
];

// 汇率数据存储（实际应用中应该从API获取）
class ExchangeRateManager {
  private rates: Map<string, ExchangeRate> = new Map();
  private historicalRates: Map<string, HistoricalRate[]> = new Map();

  constructor() {
    this.initializeDefaultRates();
  }

  // 仅 USD，无需多币种汇率
  private initializeDefaultRates() {
    this.rates.set('USD-USD', { from: 'USD', to: 'USD', rate: 1, date: new Date().toISOString().split('T')[0], source: 'default' });
  }

  // 获取当前汇率
  getCurrentRate(from: string, to: string): number {
    if (from === to) return 1;
    
    const directKey = `${from}-${to}`;
    const reverseKey = `${to}-${from}`;
    
    // 直接汇率
    if (this.rates.has(directKey)) {
      return this.rates.get(directKey)!.rate;
    }
    
    // 反向汇率
    if (this.rates.has(reverseKey)) {
      return 1 / this.rates.get(reverseKey)!.rate;
    }
    
    // 通过USD中转
    if (from !== 'USD' && to !== 'USD') {
      const fromToUSD = this.getCurrentRate(from, 'USD');
      const usdToTarget = this.getCurrentRate('USD', to);
      return fromToUSD * usdToTarget;
    }
    
    return 1; // 默认汇率
  }

  // 获取历史汇率
  getHistoricalRate(from: string, to: string, date: string): number {
    if (from === to) return 1;
    
    // 查找最接近的历史汇率
    const historicalData = this.historicalRates.get(date);
    if (historicalData && historicalData.length > 0) {
      const rates = historicalData[0].rates;
      const key = `${from}-${to}`;
      if (rates[key]) {
        return rates[key];
      }
    }
    
    // 如果没有历史数据，返回当前汇率
    return this.getCurrentRate(from, to);
  }

  // 更新汇率
  updateRate(from: string, to: string, rate: number, date?: string) {
    const rateDate = date || new Date().toISOString().split('T')[0];
    const key = `${from}-${to}`;
    
    this.rates.set(key, {
      from,
      to,
      rate,
      date: rateDate,
      source: 'Manual'
    });
  }

  // 获取所有支持的货币
  getSupportedCurrencies(): CurrencyInfo[] {
    return SUPPORTED_CURRENCIES;
  }

  // 获取货币信息
  getCurrencyInfo(code: string): CurrencyInfo | undefined {
    return SUPPORTED_CURRENCIES.find(currency => currency.code === code);
  }
}

// 创建全局汇率管理器实例
export const exchangeRateManager = new ExchangeRateManager();

// 汇率转换函数
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: string
): number {
  if (fromCurrency === toCurrency) return amount;
  
  const rate = date 
    ? exchangeRateManager.getHistoricalRate(fromCurrency, toCurrency, date)
    : exchangeRateManager.getCurrentRate(fromCurrency, toCurrency);
  
  return amount * rate;
}

// 格式化货币显示
export function formatCurrencyAmount(
  amount: number,
  currency: string,
  showSymbol: boolean = true
): string {
  const currencyInfo = exchangeRateManager.getCurrencyInfo(currency);
  if (!currencyInfo) return amount.toString();
  
  const symbol = showSymbol ? currencyInfo.symbol : '';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  
  return `${symbol}${formatted}`;
}

// 获取汇率变化趋势
export function getRateTrend(from: string, to: string, days: number = 30): {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
} {
  const current = exchangeRateManager.getCurrentRate(from, to);
  
  // 计算之前的汇率（简化处理）
  const previousDate = new Date();
  previousDate.setDate(previousDate.getDate() - days);
  const previous = exchangeRateManager.getHistoricalRate(
    from, 
    to, 
    previousDate.toISOString().split('T')[0]
  );
  
  const change = current - previous;
  const changePercent = (change / previous) * 100;
  
  return {
    current,
    previous,
    change,
    changePercent
  };
}

// 批量汇率转换
export function convertMultipleCurrencies(
  amounts: Array<{ amount: number; currency: string }>,
  targetCurrency: string,
  date?: string
): Array<{ amount: number; currency: string; convertedAmount: number }> {
  return amounts.map(({ amount, currency }) => ({
    amount,
    currency,
    convertedAmount: convertCurrency(amount, currency, targetCurrency, date)
  }));
}
