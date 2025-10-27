'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, RefreshCw, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { exchangeRateManager, getRateTrend } from '../../lib/exchangeRates';
import { useI18nContext } from '../../contexts/I18nProvider';

interface CurrencySettingsProps {
  baseCurrency: string;
  onBaseCurrencyChange: (currency: string) => void;
}

export default function CurrencySettings({ baseCurrency, onBaseCurrencyChange }: CurrencySettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rateTrends, setRateTrends] = useState<Record<string, {
    change: number;
    changePercent: number;
    current: number;
    previous: number;
  }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useI18nContext();

  const supportedCurrencies = exchangeRateManager.getSupportedCurrencies();

  const loadRateTrends = useCallback(async () => {
    setIsLoading(true);
    const trends: Record<string, {
      change: number;
      changePercent: number;
      current: number;
      previous: number;
    }> = {};
    
    // 获取主要货币对USD的汇率趋势
    const mainCurrencies = ['EUR', 'GBP', 'CNY', 'JPY'];
    
    for (const currency of mainCurrencies) {
      if (currency !== baseCurrency) {
        try {
          const trend = getRateTrend(currency, baseCurrency);
          trends[currency] = trend;
        } catch (error) {
          console.error(`Failed to load trend for ${currency}:`, error);
        }
      }
    }
    
    setRateTrends(trends);
    setIsLoading(false);
  }, [baseCurrency]);

  useEffect(() => {
    loadRateTrends();
  }, [loadRateTrends]);

  const handleCurrencyChange = (currency: string) => {
    onBaseCurrencyChange(currency);
    setIsOpen(false);
  };

  const getTrendIcon = (changePercent: number) => {
    if (changePercent > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (changePercent < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <DollarSign className="h-4 w-4 text-gray-500" />;
  };

  const getTrendColor = (changePercent: number) => {
    if (changePercent > 0) return 'text-green-600';
    if (changePercent < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Settings className="h-4 w-4" />
        <span className="font-medium">{t('dashboard.currencySettings')}</span>
        <span className="text-sm text-gray-500">
          {supportedCurrencies.find(c => c.code === baseCurrency)?.flag} {baseCurrency}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.currencySettings')}</h3>
              <button
                onClick={loadRateTrends}
                disabled={isLoading}
                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* 基础货币选择 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('dashboard.baseCurrency')} (Base Currency)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {supportedCurrencies.slice(0, 8).map((currency) => (
                  <button
                    key={currency.code}
                    onClick={() => handleCurrencyChange(currency.code)}
                    className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                      baseCurrency === currency.code
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg">{currency.flag}</span>
                    <div className="text-left">
                      <div className="font-medium">{currency.code}</div>
                      <div className="text-xs text-gray-500">{currency.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 汇率趋势 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">汇率趋势 (vs {baseCurrency})</h4>
              <div className="space-y-2">
                {Object.entries(rateTrends).map(([currency, trend]) => {
                  const currencyInfo = supportedCurrencies.find(c => c.code === currency);
                  return (
                    <div key={currency} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{currencyInfo?.flag}</span>
                        <span className="font-medium">{currency}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(trend.changePercent)}
                        <span className={`text-sm font-medium ${getTrendColor(trend.changePercent)}`}>
                          {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(2)}%
                        </span>
                        <span className="text-xs text-gray-500">
                          1 {currency} = {trend.current.toFixed(4)} {baseCurrency}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 说明 */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                💡 基础货币用于统一计算所有交易的价值。系统会自动根据历史汇率计算不同货币交易的真实成本。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
