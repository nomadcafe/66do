'use client';

import { useState, useEffect } from 'react';
import { X, Save, DollarSign, Calendar, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { exchangeRateManager, formatCurrencyAmount, getRateTrend } from '../../lib/exchangeRates';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { Domain, Transaction } from '../../lib/supabaseService';
import DateInput from '../ui/DateInput';

// 使用统一的类型定义，从 supabaseService 导入

interface TransactionFormProps {
  transaction?: TransactionWithRequiredFields;
  domains: DomainWithTags[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<TransactionWithRequiredFields, 'id'>) => void;
  onSaleComplete?: (transaction: Omit<TransactionWithRequiredFields, 'id'>, domain: DomainWithTags) => void;
}

export default function TransactionForm({ 
  transaction, 
  domains, 
  isOpen, 
  onClose, 
  onSave,
  onSaleComplete
}: TransactionFormProps) {
  const { t } = useI18nContext();
  const [formData, setFormData] = useState({
    domain_id: '',
    type: 'buy' as 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'installment_payment' | 'installment_refund',
    amount: 0,
    currency: 'USD',
    exchange_rate: 1,
    base_amount: 0,
    platform_fee: 0,
    platform_fee_percentage: 0,
    net_amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: '',
    platform: '',
    category: '',
    tax_deductible: false,
    receipt_url: '',
    // 分期付款相关字段
    payment_plan: 'lump_sum' as 'lump_sum' | 'installment',
    installment_period: 1,
    downpayment_amount: 0,
    installment_amount: 0,
    final_payment_amount: 0,
    total_installment_amount: 0
  });

  const [baseCurrency] = useState('USD');
  const [exchangeRateInfo, setExchangeRateInfo] = useState<{
    rate: number;
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
  } | null>(null);

  // 续费成本历史状态
  const [renewalCostHistory, setRenewalCostHistory] = useState<Array<{
    date: string;
    cost: number;
    currency: string;
  }>>([]);
  const [showCostHistory, setShowCostHistory] = useState(false);
  const [suggestedRenewalCost, setSuggestedRenewalCost] = useState<number | null>(null);

  useEffect(() => {
    if (transaction) {
      setFormData({
        domain_id: transaction.domain_id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        exchange_rate: transaction.exchange_rate || 1,
        base_amount: transaction.base_amount || 0,
        platform_fee: transaction.platform_fee || 0,
        platform_fee_percentage: transaction.platform_fee_percentage || 0,
        net_amount: transaction.net_amount || 0,
        date: transaction.date,
        notes: transaction.notes || '',
        platform: '',
        category: transaction.category || '',
        tax_deductible: transaction.tax_deductible || false,
        receipt_url: transaction.receipt_url || '',
        // 分期付款相关字段
        payment_plan: transaction.payment_plan || 'lump_sum',
        installment_period: transaction.installment_period || 1,
        downpayment_amount: transaction.downpayment_amount || 0,
        installment_amount: transaction.installment_amount || 0,
        final_payment_amount: transaction.final_payment_amount || 0,
        total_installment_amount: transaction.total_installment_amount || 0
      });
    } else {
      setFormData({
        domain_id: '',
        type: 'buy' as 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'installment_payment' | 'installment_refund',
        amount: 0,
        currency: 'USD',
        exchange_rate: 1,
        base_amount: 0,
        platform_fee: 0,
        platform_fee_percentage: 0,
        net_amount: 0,
        date: new Date().toISOString().split('T')[0],
        notes: '',
        platform: '',
        category: '',
        tax_deductible: false,
        receipt_url: '',
        // 分期付款相关字段
        payment_plan: 'lump_sum' as 'lump_sum' | 'installment',
        installment_period: 1,
        downpayment_amount: 0,
        installment_amount: 0,
        final_payment_amount: 0,
        total_installment_amount: 0
      });
    }
  }, [transaction]);

  // 加载续费成本历史
  useEffect(() => {
    const loadRenewalCostHistory = async () => {
      if (formData.domain_id && formData.type === 'renew') {
        try {
          const response = await fetch(`/api/renewal-cost-history?domain_id=${formData.domain_id}`);
          if (response.ok) {
            const history = await response.json();
            setRenewalCostHistory(history.data || []);
            
            // 计算建议的续费成本
            if (history.data && history.data.length > 0) {
              const costs = history.data.map((item: { renewal_cost: number }) => item.renewal_cost);
              const averageCost = costs.reduce((sum: number, cost: number) => sum + cost, 0) / costs.length;
              setSuggestedRenewalCost(averageCost);
            }
          }
        } catch (error) {
          console.error('Error loading renewal cost history:', error);
        }
      } else {
        setRenewalCostHistory([]);
        setSuggestedRenewalCost(null);
      }
    };

    loadRenewalCostHistory();
  }, [formData.domain_id, formData.type]);

  // 自动计算分期付款金额
  useEffect(() => {
    if (formData.payment_plan === 'installment' && formData.amount > 0 && formData.installment_period > 0) {
      const remainingAmount = formData.amount - formData.downpayment_amount - formData.final_payment_amount;
      const regularPeriods = formData.installment_period - (formData.final_payment_amount > 0 ? 1 : 0);
      
      if (regularPeriods > 0) {
        const calculatedInstallmentAmount = remainingAmount / regularPeriods;
        if (Math.abs(formData.installment_amount - calculatedInstallmentAmount) > 0.01) {
          setFormData(prev => ({ ...prev, installment_amount: calculatedInstallmentAmount }));
        }
      }
    }
  }, [formData.amount, formData.downpayment_amount, formData.final_payment_amount, formData.installment_period, formData.payment_plan]);

  // 汇率处理逻辑
  useEffect(() => {
    if (formData.currency !== baseCurrency && formData.amount > 0) {
      const rate = exchangeRateManager.getCurrentRate(formData.currency, baseCurrency);
      const trend = getRateTrend(formData.currency, baseCurrency);
      
      setFormData(prev => ({
        ...prev,
        exchange_rate: rate,
        base_amount: formData.amount * rate
      }));
      
      setExchangeRateInfo({
        rate,
        trend: trend.changePercent > 0 ? 'up' : trend.changePercent < 0 ? 'down' : 'stable',
        changePercent: trend.changePercent
      });
    }
  }, [formData.currency, formData.amount, baseCurrency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 自动计算净收入
    const calculatedNetAmount = formData.amount - formData.platform_fee;
    const finalFormData = {
      ...formData,
      net_amount: calculatedNetAmount,
      user_id: '',
      created_at: '',
      updated_at: ''
    };
    
    // 移除数据库中不存在的字段
    const { platform, ...dataWithoutPlatform } = finalFormData;
    const finalFormDataClean = dataWithoutPlatform;
    
    onSave(finalFormDataClean);
    
    // 如果是出售交易，触发分享功能
    if (finalFormDataClean.type === 'sell' && onSaleComplete) {
      const selectedDomain = domains.find(d => d.id === finalFormDataClean.domain_id);
      if (selectedDomain) {
        onSaleComplete(finalFormDataClean, selectedDomain);
      }
    }
    
    onClose();
  };

  const transactionTypes = [
    { value: 'buy', label: 'Purchase' },
    { value: 'renew', label: 'Renewal' },
    { value: 'sell', label: 'Sale' },
    { value: 'installment_payment', label: 'Installment Payment' },
    { value: 'installment_refund', label: 'Installment Refund' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'fee', label: 'Fee' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'advertising', label: 'Advertising' }
  ];

  const currencies = exchangeRateManager.getSupportedCurrencies().map(currency => ({
    value: currency.code,
    label: `${currency.flag} ${currency.code}`
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {transaction ? 'Edit Transaction' : 'Add New Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Domain *
            </label>
            <select
              required
              value={formData.domain_id}
              onChange={(e) => setFormData({ ...formData, domain_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a domain</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.domain_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Type *
              </label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {transactionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 续费成本历史显示 */}
            {formData.type === 'renew' && formData.domain_id && (
              <div className="md:col-span-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-blue-900">Renewal Cost History</h4>
                    <button
                      type="button"
                      onClick={() => setShowCostHistory(!showCostHistory)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {showCostHistory ? 'Hide' : 'Show'} History
                    </button>
                  </div>
                  
                  {suggestedRenewalCost && (
                    <div className="mb-2">
                      <span className="text-sm text-blue-700">
                        Suggested cost: {formatCurrencyAmount(suggestedRenewalCost, formData.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, amount: suggestedRenewalCost })}
                        className="ml-2 text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        Use suggested
                      </button>
                    </div>
                  )}

                  {showCostHistory && (
                    <div className="max-h-32 overflow-y-auto">
                      {renewalCostHistory.length > 0 ? (
                        <div className="space-y-1">
                          {renewalCostHistory.map((record, index) => (
                            <div key={index} className="flex justify-between text-xs text-blue-700">
                              <span>{new Date(record.date).toLocaleDateString()}</span>
                              <span>{formatCurrencyAmount(record.cost, record.currency)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-blue-600">No renewal history found</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <DateInput
              label="Date"
              icon={<Calendar className="h-4 w-4" />}
              value={formData.date}
              onChange={(value) => setFormData({ ...formData, date: value })}
              required
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Amount *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {currencies.map((currency) => (
                  <option key={currency.value} value={currency.value}>
                    {currency.label}
                  </option>
                ))}
              </select>
              
              {/* 汇率信息显示 */}
              {exchangeRateInfo && formData.currency !== baseCurrency && (
                <div className="mt-2 p-2 bg-blue-50 rounded-md">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {t('transaction.exchangeRateDesc')}: 1 {formData.currency} = {exchangeRateInfo.rate.toFixed(4)} {baseCurrency}
                    </span>
                    <div className="flex items-center">
                      {exchangeRateInfo.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                      {exchangeRateInfo.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                      <span className={`ml-1 text-xs ${
                        exchangeRateInfo.trend === 'up' ? 'text-green-600' : 
                        exchangeRateInfo.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {exchangeRateInfo.changePercent > 0 ? '+' : ''}{exchangeRateInfo.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('transaction.equivalentAmount')}: {formatCurrencyAmount(formData.base_amount, baseCurrency)}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform
              </label>
              <input
                type="text"
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="GoDaddy, Namecheap, etc."
              />
            </div>
          </div>

          {/* 新增财务字段 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exchange Rate
              </label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={formData.exchange_rate}
                onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1.0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Fee (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.platform_fee_percentage}
                onChange={(e) => {
                  const percentage = parseFloat(e.target.value) || 0;
                  const calculatedFee = (formData.amount * percentage) / 100;
                  setFormData({ 
                    ...formData, 
                    platform_fee_percentage: percentage,
                    platform_fee: calculatedFee
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* 净收入显示 */}
          {formData.type === 'sell' && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">{t('transaction.netIncomeCalculation')}</p>
                  <p className="text-lg font-semibold text-green-900">
                    {formatCurrencyAmount(formData.amount - formData.platform_fee, formData.currency)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {t('transaction.totalAmount')}: {formatCurrencyAmount(formData.amount, formData.currency)} - {t('transaction.platformFeeDesc')}: {formatCurrencyAmount(formData.platform_fee, formData.currency)}
                  </p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
          )}

          {/* 分期付款配置 */}
          {formData.type === 'sell' && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="text-lg font-medium text-blue-900 mb-4">{t('transaction.installmentConfig')}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    {t('transaction.paymentPlan')}
                  </label>
                  <select
                    value={formData.payment_plan}
                    onChange={(e) => setFormData({ ...formData, payment_plan: e.target.value as 'lump_sum' | 'installment' })}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="lump_sum">{t('transaction.lumpSum')}</option>
                    <option value="installment">{t('transaction.installment')}</option>
                  </select>
                </div>

                {formData.payment_plan === 'installment' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        {t('transaction.installmentPeriod')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={formData.installment_period}
                        onChange={(e) => setFormData({ ...formData, installment_period: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="12"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        {t('transaction.downpaymentAmount')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.downpayment_amount}
                        onChange={(e) => setFormData({ ...formData, downpayment_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        {t('transaction.installmentAmount')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.installment_amount}
                        onChange={(e) => setFormData({ ...formData, installment_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        {t('transaction.finalPaymentAmount')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.final_payment_amount}
                        onChange={(e) => setFormData({ ...formData, final_payment_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  </>
                )}
              </div>

              {formData.payment_plan === 'installment' && (
                <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">{t('transaction.installmentSummary')}</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>{t('transaction.totalAmount')}: {formatCurrencyAmount(formData.amount, formData.currency)}</p>
                    <p>{t('transaction.downpayment')}: {formatCurrencyAmount(formData.downpayment_amount, formData.currency)}</p>
                    <p>{t('transaction.installmentPeriods')}: {formData.installment_period}</p>
                    <p>{t('transaction.regularInstallment')}: {formatCurrencyAmount(formData.installment_amount, formData.currency)}</p>
                    {formData.final_payment_amount > 0 && (
                      <p>{t('transaction.finalPayment')}: {formatCurrencyAmount(formData.final_payment_amount, formData.currency)}</p>
                    )}
                    <p className="font-medium">
                      {t('transaction.totalInstallment')}: {formatCurrencyAmount(
                        formData.downpayment_amount + 
                        (formData.installment_amount * (formData.installment_period - (formData.final_payment_amount > 0 ? 1 : 0))) + 
                        formData.final_payment_amount, 
                        formData.currency
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Investment, Marketing, etc."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="tax_deductible"
                checked={formData.tax_deductible}
                onChange={(e) => setFormData({ ...formData, tax_deductible: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="tax_deductible" className="ml-2 block text-sm text-gray-700">
                Tax Deductible
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt URL
            </label>
            <input
              type="url"
              value={formData.receipt_url}
              onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/receipt.pdf"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 inline mr-1" />
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes about this transaction..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{transaction ? 'Update Transaction' : 'Add Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
