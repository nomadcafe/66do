// 货币展示工具（应用为 USD-only，不做汇率换算）

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

// 格式化货币显示
export function formatCurrencyAmount(
  amount: number,
  currency: string,
  showSymbol: boolean = true
): string {
  const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency);
  if (!currencyInfo) return amount.toString();

  const symbol = showSymbol ? currencyInfo.symbol : '';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  return `${symbol}${formatted}`;
}
