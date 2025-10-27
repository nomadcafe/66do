'use client';

import { useState, useEffect } from 'react';
import { X, Save, DollarSign, Calendar, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { exchangeRateManager, formatCurrencyAmount, getRateTrend } from '../../lib/exchangeRates';
import { useI18nContext } from '../../contexts/I18nProvider';
import { calculateCustomerTotalFromInstallment, calculatePaidAmountFromInstallment } from '../../lib/platformFeeCalculator';
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
    type: 'buy' as 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising',
    amount: 0,
    currency: 'USD',
    exchange_rate: 1,
    base_amount: 0,
    platform_fee: 0,
    platform_fee_percentage: 0,
    net_amount: 0,
    date: '',
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
    total_installment_amount: 0,
    // 分期进度跟踪
    paid_periods: 0,
    installment_status: 'active' as 'active' | 'completed' | 'cancelled' | 'paused',
    platform_fee_type: 'standard' as 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment',
    // 用户输入的费用率
    user_input_fee_rate: 0,
    user_input_surcharge_rate: 0
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
        total_installment_amount: transaction.total_installment_amount || 0,
        // 分期进度跟踪
        paid_periods: transaction.paid_periods || 0,
        installment_status: transaction.installment_status || 'active',
        platform_fee_type: transaction.platform_fee_type || 'standard',
        // 用户输入的费用率
        user_input_fee_rate: transaction.user_input_fee_rate || 0,
        user_input_surcharge_rate: transaction.user_input_surcharge_rate || 0
      });
    } else {
      setFormData({
        domain_id: '',
        type: 'buy' as 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising',
        amount: 0,
        currency: 'USD',
        exchange_rate: 1,
        base_amount: 0,
        platform_fee: 0,
        platform_fee_percentage: 0,
        net_amount: 0,
        date: '',
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
        total_installment_amount: 0,
        // 分期进度跟踪
        paid_periods: 0,
        installment_status: 'active' as 'active' | 'completed' | 'cancelled' | 'paused',
        platform_fee_type: 'standard' as 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment',
        // 用户输入的费用率
        user_input_fee_rate: 0,
        user_input_surcharge_rate: 0
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
              {t('transaction.domain')} *
            </label>
            <select
              required
              value={formData.domain_id}
              onChange={(e) => setFormData({ ...formData, domain_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('transaction.selectDomain')}</option>
              {domains
                .filter(domain => domain.status === 'active' || domain.status === 'for_sale')
                .map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.domain_name} ({domain.status === 'active' ? t('transaction.active') : t('transaction.forSale')})
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
              <h3 className="text-lg font-medium text-blue-900 mb-4">
                {t('transaction.installmentConfig')}
              </h3>
              
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

                    {/* 平台费用类型 */}
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        {t('transaction.platformFeeType')}
                      </label>
                      <select
                        value={formData.platform_fee_type}
                        onChange={(e) => setFormData({ ...formData, platform_fee_type: e.target.value as 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment' })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="standard">{t('transaction.standardFee')}</option>
                        <option value="afternic_installment">{t('transaction.afternicInstallment')}</option>
                        <option value="atom_installment">{t('transaction.atomInstallment')}</option>
                        <option value="spaceship_installment">{t('transaction.spaceshipInstallment')}</option>
                        <option value="escrow_installment">{t('transaction.escrowInstallment')}</option>
                      </select>
                    </div>

                    {/* 分期进度跟踪 */}
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        {t('transaction.paidPeriods')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={formData.installment_period}
                        value={formData.paid_periods}
                        onChange={(e) => setFormData({ ...formData, paid_periods: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        {t('transaction.installmentStatus')}
                      </label>
                      <select
                        value={formData.installment_status}
                        onChange={(e) => setFormData({ ...formData, installment_status: e.target.value as 'active' | 'completed' | 'cancelled' | 'paused' })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">{t('transaction.active')}</option>
                        <option value="completed">{t('transaction.completed')}</option>
                        <option value="cancelled">{t('transaction.cancelled')}</option>
                        <option value="paused">{t('transaction.paused')}</option>
                      </select>
                    </div>

                    {/* 用户输入费用率 */}
                    {formData.platform_fee_type === 'afternic_installment' && (
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-2">
                          {t('transaction.userInputFeeRate')}
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={formData.user_input_fee_rate}
                            onChange={(e) => setFormData({ ...formData, user_input_fee_rate: parseFloat(e.target.value) || 0 })}
                            className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.30"
                          />
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          {t('transaction.userInputFeeRateDesc')}
                        </p>
                      </div>
                    )}

                    {formData.platform_fee_type === 'atom_installment' && (
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-2">
                          {t('transaction.userInputSurchargeRate')}
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={formData.user_input_surcharge_rate}
                            onChange={(e) => setFormData({ ...formData, user_input_surcharge_rate: parseFloat(e.target.value) || 0 })}
                            className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.20"
                          />
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          {t('transaction.userInputSurchargeRateDesc')}
                        </p>
                      </div>
                    )}
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
                    
                    {/* 平台费用计算 */}
                    {formData.payment_plan === 'installment' && formData.installment_amount > 0 && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <h5 className="text-sm font-medium text-yellow-900 mb-2">{t('transaction.platformFeeCalculation')}</h5>
                        {(() => {
                          try {
                            const result = calculateCustomerTotalFromInstallment(
                              formData.installment_amount,
                              formData.installment_period,
                              formData.platform_fee_type || 'standard',
                              undefined, // customFeeRate
                              undefined, // escrowFee
                              undefined, // domainHoldingFee
                              formData.user_input_fee_rate,
                              formData.user_input_surcharge_rate
                            );
                            
                            return (
                              <div className="text-sm text-yellow-800 space-y-1">
                                <p><strong>{t('transaction.customerTotalAmount')}:</strong> {formatCurrencyAmount(result.customerTotalAmount, formData.currency)}</p>
                                <p><strong>{t('transaction.platformFee')}:</strong> {formatCurrencyAmount(result.platformFee, formData.currency)} ({(result.platformFeeRate * 100).toFixed(1)}%)</p>
                                <p><strong>{t('transaction.sellerNetAmount')}:</strong> {formatCurrencyAmount(result.sellerNetAmount, formData.currency)}</p>
                                
                                  {result.breakdown.surchargeAmount && (
                                    <div className="mt-2 text-xs text-yellow-700">
                                      <p>{t('transaction.baseAmount')}: {formatCurrencyAmount(result.breakdown.baseAmount, formData.currency)}</p>
                                      <p>{t('transaction.surchargeAmount')}: {formatCurrencyAmount(result.breakdown.surchargeAmount, formData.currency)}</p>
                                    </div>
                                  )}
                                  
                                  {/* Afternic详细分解 */}
                                  {formData.platform_fee_type === 'afternic_installment' && result.breakdown.serviceFee !== undefined && (
                                    <div className="mt-2 text-xs text-yellow-700">
                                      <p><strong>{t('transaction.listPrice')}:</strong> {formatCurrencyAmount(result.breakdown.baseAmount, formData.currency)}</p>
                                      <p><strong>{t('transaction.serviceFee')}:</strong> {formatCurrencyAmount(result.breakdown.serviceFee, formData.currency)} ({(result.breakdown.serviceFeeRate! * 100).toFixed(1)}%)</p>
                                      <p><strong>{t('transaction.commission')}:</strong> {formatCurrencyAmount(result.breakdown.commission!, formData.currency)} ({(result.breakdown.commissionRate! * 100).toFixed(1)}%)</p>
                                      <p><strong>{t('transaction.commissionDiscount')}:</strong> {(result.breakdown.commissionDiscount! * 100).toFixed(1)}%</p>
                                    </div>
                                  )}
                              </div>
                            );
                          } catch (error) {
                            return (
                              <p className="text-sm text-yellow-700">
                                {t('transaction.calculationError')}: {error instanceof Error ? error.message : 'Unknown error'}
                              </p>
                            );
                          }
                        })()}
                      </div>
                    )}
                    
                    {/* 分期进度信息 */}
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <p className="text-blue-700">
                        {t('transaction.paidPeriods')}: {formData.paid_periods} / {formData.installment_period}
                      </p>
                      <p className="text-blue-700">
                        {t('transaction.installmentStatus')}: {t(`transaction.${formData.installment_status}`)}
                      </p>
                      <p className="text-blue-700">
                        {t('transaction.platformFeeType')}: {t(`transaction.${formData.platform_fee_type}`)}
                      </p>
                      
                      {/* 已付期数实际金额计算 */}
                      {formData.paid_periods > 0 && formData.installment_amount > 0 && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                          <h5 className="text-sm font-medium text-green-900 mb-2">{t('transaction.paidAmountCalculation')}</h5>
                          {(() => {
                            try {
                              const result = calculatePaidAmountFromInstallment(
                                formData.installment_amount,
                                formData.paid_periods,
                                formData.installment_period, // 总期数
                                formData.platform_fee_type || 'standard',
                                undefined, // customFeeRate
                                undefined, // escrowFee
                                undefined, // domainHoldingFee
                                formData.user_input_fee_rate,
                                formData.user_input_surcharge_rate
                              );
                              
                              return (
                                <div className="text-sm text-green-800 space-y-1">
                                  <p><strong>{t('transaction.actualPaidAmount')}:</strong> {formatCurrencyAmount(result.sellerNetAmount, formData.currency)}</p>
                                  <p><strong>{t('transaction.customerPaidTotal')}:</strong> {formatCurrencyAmount(result.customerTotalAmount, formData.currency)}</p>
                                  <p><strong>{t('transaction.platformFeePaid')}:</strong> {formatCurrencyAmount(result.platformFee, formData.currency)} ({(result.platformFeeRate * 100).toFixed(1)}%)</p>
                                  
                                  {result.breakdown.surchargeAmount && (
                                    <div className="mt-2 text-xs text-green-700">
                                      <p>{t('transaction.baseAmount')}: {formatCurrencyAmount(result.breakdown.baseAmount, formData.currency)}</p>
                                      <p>{t('transaction.surchargeAmount')}: {formatCurrencyAmount(result.breakdown.surchargeAmount, formData.currency)}</p>
                                    </div>
                                  )}
                                  
                                  {/* Afternic详细分解 */}
                                  {formData.platform_fee_type === 'afternic_installment' && result.breakdown.serviceFee !== undefined && (
                                    <div className="mt-2 text-xs text-green-700">
                                      <p><strong>{t('transaction.listPrice')}:</strong> {formatCurrencyAmount(result.breakdown.baseAmount, formData.currency)}</p>
                                      <p><strong>{t('transaction.serviceFee')}:</strong> {formatCurrencyAmount(result.breakdown.serviceFee, formData.currency)} ({(result.breakdown.serviceFeeRate! * 100).toFixed(1)}%)</p>
                                      <p><strong>{t('transaction.commission')}:</strong> {formatCurrencyAmount(result.breakdown.commission!, formData.currency)} ({(result.breakdown.commissionRate! * 100).toFixed(1)}%)</p>
                                      <p><strong>{t('transaction.commissionDiscount')}:</strong> {(result.breakdown.commissionDiscount! * 100).toFixed(1)}%</p>
                                    </div>
                                  )}
                                </div>
                              );
                            } catch (error) {
                              return (
                                <p className="text-sm text-green-700">
                                  {t('transaction.calculationError')}: {error instanceof Error ? error.message : 'Unknown error'}
                                </p>
                              );
                            }
                          })()}
                        </div>
                      )}
                      
                      {/* 进度条 */}
                      <div className="mt-2">
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${(formData.paid_periods / formData.installment_period) * 100}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          {Math.round((formData.paid_periods / formData.installment_period) * 100)}% {t('transaction.completed')}
                        </p>
                      </div>
                    </div>
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
