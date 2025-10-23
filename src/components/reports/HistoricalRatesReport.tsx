'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, DollarSign, RefreshCw } from 'lucide-react';
import { exchangeRateManager, convertCurrency, formatCurrencyAmount } from '../../lib/exchangeRates';

interface HistoricalRatesReportProps {
  transactions: Array<{
    id: string;
    amount: number;
    currency: string;
    date: string;
    type: string;
  }>;
}

export default function HistoricalRatesReport({ transactions }: HistoricalRatesReportProps) {
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [convertedTransactions, setConvertedTransactions] = useState<Array<{
    id: string;
    amount: number;
    currency: string;
    date: string;
    type: string;
    originalAmount: number;
    originalCurrency: string;
    exchangeRate: number;
    convertedAmount: number;
    baseCurrency: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const supportedCurrencies = exchangeRateManager.getSupportedCurrencies();

  const convertTransactionsToBaseCurrency = useCallback(async () => {
    setIsLoading(true);
    
    const converted = transactions.map(transaction => {
      const rate = exchangeRateManager.getHistoricalRate(
        transaction.currency, 
        baseCurrency, 
        transaction.date
      );
      
      const convertedAmount = convertCurrency(
        transaction.amount, 
        transaction.currency, 
        baseCurrency, 
        transaction.date
      );
      
      return {
        ...transaction,
        originalAmount: transaction.amount,
        originalCurrency: transaction.currency,
        exchangeRate: rate,
        convertedAmount,
        baseCurrency
      };
    });
    
    setConvertedTransactions(converted);
    setIsLoading(false);
  }, [baseCurrency, transactions]);

  useEffect(() => {
    convertTransactionsToBaseCurrency();
  }, [convertTransactionsToBaseCurrency]);


  const getTotalByCurrency = () => {
    const totals: Record<string, number> = {};
    
    convertedTransactions.forEach(transaction => {
      if (!totals[transaction.originalCurrency]) {
        totals[transaction.originalCurrency] = 0;
      }
      totals[transaction.originalCurrency] += transaction.convertedAmount;
    });
    
    return totals;
  };

  const getTotalInBaseCurrency = () => {
    return convertedTransactions.reduce((sum, transaction) => sum + transaction.convertedAmount, 0);
  };

  const getCurrencyTrend = (currency: string) => {
    const currencyTransactions = convertedTransactions.filter(t => t.originalCurrency === currency);
    if (currencyTransactions.length < 2) return null;
    
    const sorted = currencyTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    const change = last.exchangeRate - first.exchangeRate;
    const changePercent = (change / first.exchangeRate) * 100;
    
    return {
      change,
      changePercent,
      firstRate: first.exchangeRate,
      lastRate: last.exchangeRate
    };
  };

  const totals = getTotalByCurrency();
  const totalInBase = getTotalInBaseCurrency();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <DollarSign className="h-5 w-5 mr-2" />
          历史汇率分析
        </h3>
        <button
          onClick={convertTransactionsToBaseCurrency}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>刷新</span>
        </button>
      </div>

      {/* 控制面板 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            基础货币
          </label>
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {supportedCurrencies.map(currency => (
              <option key={currency.code} value={currency.code}>
                {currency.flag} {currency.code} - {currency.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            分析日期
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 汇总统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 mb-1">总价值 (统一货币)</div>
          <div className="text-2xl font-bold text-blue-700">
            {formatCurrencyAmount(totalInBase, baseCurrency)}
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 mb-1">涉及货币种类</div>
          <div className="text-2xl font-bold text-green-700">
            {Object.keys(totals).length}
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 mb-1">交易记录数</div>
          <div className="text-2xl font-bold text-purple-700">
            {convertedTransactions.length}
          </div>
        </div>
      </div>

      {/* 按货币分类统计 */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">按货币分类统计</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(totals).map(([currency, total]) => {
            const currencyInfo = supportedCurrencies.find(c => c.code === currency);
            const trend = getCurrencyTrend(currency);
            
            return (
              <div key={currency} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{currencyInfo?.flag}</span>
                    <span className="font-medium">{currency}</span>
                  </div>
                  {trend && (
                    <div className="flex items-center space-x-1">
                      {trend.changePercent > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : trend.changePercent < 0 ? (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <DollarSign className="h-4 w-4 text-gray-500" />
                      )}
                      <span className={`text-sm ${
                        trend.changePercent > 0 ? 'text-green-600' : 
                        trend.changePercent < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatCurrencyAmount(total, baseCurrency)}
                </div>
                
                <div className="text-sm text-gray-600">
                  汇率范围: {trend?.firstRate.toFixed(4)} - {trend?.lastRate.toFixed(4)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 详细交易记录 */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-4">详细交易记录</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2">日期</th>
                <th className="text-left py-2">类型</th>
                <th className="text-left py-2">原始金额</th>
                <th className="text-left py-2">汇率</th>
                <th className="text-left py-2">转换后金额</th>
              </tr>
            </thead>
            <tbody>
              {convertedTransactions.map((transaction, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2">{transaction.date}</td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      transaction.type === 'sell' ? 'bg-green-100 text-green-700' :
                      transaction.type === 'buy' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="py-2">
                    {formatCurrencyAmount(transaction.originalAmount, transaction.originalCurrency)}
                  </td>
                  <td className="py-2">
                    {transaction.exchangeRate.toFixed(4)}
                  </td>
                  <td className="py-2 font-medium">
                    {formatCurrencyAmount(transaction.convertedAmount, baseCurrency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
