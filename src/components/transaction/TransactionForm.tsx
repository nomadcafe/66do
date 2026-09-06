'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Save, DollarSign, Calendar, FileText, Search, ChevronDown } from 'lucide-react';
import { formatCurrencyAmount } from '../../lib/exchangeRates';
import {
  getAfternicEffectiveCommissionRate,
  getAtomBaseCommissionAmount,
  getAtomSurchargeRate,
  ATOM_SURCHARGE_SELLER_SHARE,
} from '../../lib/platformFeeCalculator';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import DateInput from '../ui/DateInput';
import InstallmentConfig from './InstallmentConfig';

// 使用统一的类型定义，从 supabaseService 导入

interface TransactionFormProps {
  transaction?: TransactionWithRequiredFields;
  domains: DomainWithTags[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<TransactionWithRequiredFields, 'id'>) => void | Promise<void>;
  onSaleComplete?: (transaction: Omit<TransactionWithRequiredFields, 'id'>, domain: DomainWithTags) => void;
  /** 现有交易，用于 category 的 datalist 自动补全 */
  existingTransactions?: TransactionWithRequiredFields[];
}

const buildEmptyFormData = ({ preserveDomainId = '' }: { preserveDomainId?: string } = {}) => ({
  domain_id: preserveDomainId,
  type: 'buy' as 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising',
  amount: 0,
  currency: 'USD',
  platform_fee: 0,
  platform_fee_percentage: 0,
  net_amount: 0,
  date: '',
  notes: '',
  platform: '',
  category: '',
  tax_deductible: false,
  receipt_url: '',
  payment_plan: 'lump_sum' as 'lump_sum' | 'installment',
  installment_period: 1,
  downpayment_amount: 0,
  installment_amount: 0,
  final_payment_amount: 0,
  total_installment_amount: 0,
  installment_status: 'active' as 'active' | 'completed' | 'cancelled' | 'paused',
  installment_first_payment_date: '',
  platform_fee_type:
    'standard' as 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment',
  user_input_fee_rate: 0,
  user_input_surcharge_rate: 0,
  // Afternic Installment 标准佣金两个开关：默认 NS 指向 + 无 add-on = 15%
  afternic_ns_pointed: true,
  afternic_premium_addon: false,
  // Atom Installment 卖家级别：默认 standard (7.5%)，向后兼容旧记录
  atom_commission_tier: 'standard' as 'standard' | 'plus' | 'premium' | 'byol' | 'custom',
  atom_no_coin: false,
  atom_custom_commission_rate: 0,
  // Escrow Installment：默认 lease with purchase + 0 manual transaction fee
  escrow_lease_type: 'lease_with_purchase' as 'lease_with_purchase' | 'lease_only',
  escrow_transaction_fee: 0,
  escrow_holding_fee: null as number | null,
  renewal_period_years: 1,
  renewal_years_use_custom: false
});

export default function TransactionForm({
  transaction,
  domains,
  isOpen,
  onClose,
  onSave,
  onSaleComplete,
  existingTransactions
}: TransactionFormProps) {
  const { t } = useI18nContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState(() => buildEmptyFormData());

  // 续费成本历史状态
  const [renewalCostHistory, setRenewalCostHistory] = useState<Array<{
    date: string;
    cost: number;
    currency: string;
  }>>([]);
  const [showCostHistory, setShowCostHistory] = useState(false);
  const [suggestedRenewalCost, setSuggestedRenewalCost] = useState<number | null>(null);
  const [domainSearch, setDomainSearch] = useState('');
  const [domainDropdownOpen, setDomainDropdownOpen] = useState(false);
  const domainPickerRef = useRef<HTMLDivElement>(null);

  // 可选域名：活跃、待售、已售（已售也可添加出售记录）
  const eligibleDomains = domains.filter(
    (d) => d.status === 'active' || d.status === 'for_sale' || d.status === 'sold'
  );

  const categorySuggestions = useMemo(() => {
    if (!existingTransactions?.length) return [] as string[];
    const seen = new Set<string>();
    for (const t of existingTransactions) {
      const c = (t.category || '').trim();
      if (c) seen.add(c);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [existingTransactions]);
  const platformSuggestions = useMemo(() => {
    const seen = new Set<string>();
    // 把常见交易平台作为种子，让首次填写也有可选项；用户填过的会自动加进来。
    for (const seed of ['Afternic', 'Atom', 'Sedo', 'Dan', 'Escrow.com', 'Spaceship', 'GoDaddy', 'Namecheap', 'NameSilo']) {
      seen.add(seed);
    }
    if (existingTransactions?.length) {
      for (const t of existingTransactions) {
        const p = (t.platform || '').trim();
        if (p) seen.add(p);
      }
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [existingTransactions]);
  const filteredDomains = domainSearch.trim()
    ? eligibleDomains.filter(
        (d) =>
          d.domain_name.toLowerCase().includes(domainSearch.toLowerCase()) ||
          (d.registrar || '').toLowerCase().includes(domainSearch.toLowerCase())
      )
    : eligibleDomains;
  const selectedDomain = formData.domain_id
    ? domains.find((d) => d.id === formData.domain_id)
    : null;

  useEffect(() => {
    if (!isOpen) {
      setDomainSearch('');
      setDomainDropdownOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (domainDropdownOpen) {
          setDomainDropdownOpen(false);
          return;
        }
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, domainDropdownOpen, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (domainPickerRef.current && !domainPickerRef.current.contains(e.target as Node)) {
        setDomainDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 仅随「打开/切换编辑的交易」同步表单；勿将 domains 列入依赖，否则新建交易时列表刷新会清空已填内容。
  // 域名续费周期在下方专用 effect 中与 domains 同步。
  useEffect(() => {
    if (transaction) {
      const dom = domains.find((d) => d.id === transaction.domain_id);
      const cycle = Math.min(10, Math.max(1, dom?.renewal_cycle ?? 1));
      const stored = transaction.renewal_period_years;
      const hasStored = stored != null && !Number.isNaN(Number(stored));
      // transfer 复用 renewal_period_years 表示「本次转移额外延长的年数」，
      // 0/缺省 = 不延长；renew 缺省回落到域名的续费周期。
      const isTransfer = transaction.type === 'transfer';
      const years = isTransfer
        ? hasStored
          ? Math.min(10, Math.max(0, Math.floor(Number(stored))))
          : 0
        : hasStored
          ? Math.min(10, Math.max(1, Math.floor(Number(stored))))
          : cycle;
      const useCustom = !isTransfer && hasStored && years !== cycle;
      setFormData({
        domain_id: transaction.domain_id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        platform_fee: transaction.platform_fee || 0,
        platform_fee_percentage: transaction.platform_fee_percentage || 0,
        net_amount: transaction.net_amount || 0,
        date: transaction.date,
        notes: transaction.notes || '',
        platform: transaction.platform || '',
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
        // 分期进度跟踪：paid_periods 现由 installment_receipts.length 推导，编辑表单不直接管
        installment_status: transaction.installment_status || 'active',
        installment_first_payment_date: transaction.installment_first_payment_date || '',
        platform_fee_type: transaction.platform_fee_type || 'standard',
        // 用户输入的费用率
        user_input_fee_rate: transaction.user_input_fee_rate || 0,
        user_input_surcharge_rate: transaction.user_input_surcharge_rate || 0,
        // Afternic Installment commission flags（旧数据缺失视为 NS 指向 + 无 add-on）
        afternic_ns_pointed: transaction.afternic_ns_pointed ?? true,
        afternic_premium_addon: transaction.afternic_premium_addon ?? false,
        // Atom Installment tier（旧数据缺失视为 standard 7.5%）
        atom_commission_tier: (transaction.atom_commission_tier ?? 'standard') as 'standard' | 'plus' | 'premium' | 'byol' | 'custom',
        atom_no_coin: transaction.atom_no_coin ?? false,
        atom_custom_commission_rate: transaction.atom_custom_commission_rate ?? 0,
        // Escrow Installment（旧数据缺失视为 lease with purchase + 0 transaction fee）
        escrow_lease_type: (transaction.escrow_lease_type ?? 'lease_with_purchase') as 'lease_with_purchase' | 'lease_only',
        escrow_transaction_fee: transaction.escrow_transaction_fee ?? 0,
        // ?? 而不是 ||：0 是「明确没有托管费」，不能被压成 null
        escrow_holding_fee: transaction.escrow_holding_fee ?? null,
        renewal_period_years: years,
        renewal_years_use_custom: useCustom
      });
    } else {
      setFormData(buildEmptyFormData());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随 transaction 重置；domains 见下方续费周期同步 effect
  }, [transaction]);

  useEffect(() => {
    if (formData.type !== 'renew' || !formData.domain_id || formData.renewal_years_use_custom) return;
    const dom = domains.find((d) => d.id === formData.domain_id);
    if (!dom) return;
    const next = Math.min(10, Math.max(1, dom.renewal_cycle || 1));
    setFormData((prev) => {
      if (prev.type !== 'renew' || !prev.domain_id || prev.renewal_years_use_custom) return prev;
      return prev.renewal_period_years === next ? prev : { ...prev, renewal_period_years: next };
    });
  }, [formData.type, formData.domain_id, formData.renewal_years_use_custom, domains]);

  // 续费成本历史 + 建议金额：从已有的 renew 交易派生（同一份用户填的数据，
  // 也就是 dashboard 续费分析的数据源）。编辑模式下排除正在编辑的那笔本身，
  // 避免它喂给自己当作建议的依据。
  useEffect(() => {
    if (!formData.domain_id || formData.type !== 'renew') {
      setRenewalCostHistory([]);
      setSuggestedRenewalCost(null);
      return;
    }

    const editingId = transaction?.id;
    const history = (existingTransactions || [])
      .filter(
        (t) =>
          t.type === 'renew' &&
          t.domain_id === formData.domain_id &&
          (!editingId || t.id !== editingId)
      )
      .map((t) => ({
        date: String(t.date).slice(0, 10),
        cost: Number(t.amount) || 0,
        currency: t.currency || 'USD',
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    setRenewalCostHistory(history);

    if (history.length > 0) {
      const avg = history.reduce((sum, r) => sum + r.cost, 0) / history.length;
      setSuggestedRenewalCost(avg);
    } else {
      setSuggestedRenewalCost(null);
    }
  }, [formData.domain_id, formData.type, existingTransactions, transaction?.id]);

  // 自动计算分期付款金额
  // installment_amount 的口径在所有平台下都是「卖家每月到手」。amount 是出售毛额（标价/listPrice），
  // 对 Afternic 还要先扣掉有效佣金率才得到卖家净收入，再分摊到每期。
  useEffect(() => {
    if (formData.payment_plan === 'installment' && formData.amount > 0 && formData.installment_period > 0) {
      const regularPeriods = formData.installment_period - (formData.final_payment_amount > 0 ? 1 : 0);
      if (regularPeriods <= 0) return;

      let sellerProceeds = formData.amount;
      if (formData.platform_fee_type === 'afternic_installment') {
        const effRate = getAfternicEffectiveCommissionRate(
          formData.installment_period,
          formData.afternic_ns_pointed,
          formData.afternic_premium_addon
        );
        sellerProceeds = formData.amount * (1 - effRate);
      } else if (formData.platform_fee_type === 'atom_installment') {
        // Atom: sellerNet = listPrice − baseCommission + surcharge × 65%
        const surchargeRate =
          formData.user_input_surcharge_rate > 0
            ? formData.user_input_surcharge_rate
            : getAtomSurchargeRate(formData.installment_period);
        const baseCommission = getAtomBaseCommissionAmount(formData.amount, formData.atom_commission_tier, {
          noCoin: formData.atom_no_coin,
          customRate: formData.atom_custom_commission_rate,
        });
        const surchargeAmount = formData.amount * surchargeRate;
        sellerProceeds = formData.amount - baseCommission + surchargeAmount * ATOM_SURCHARGE_SELLER_SHARE;
      }

      const remainingAmount = sellerProceeds - formData.downpayment_amount - formData.final_payment_amount;
      const calculatedInstallmentAmount = remainingAmount / regularPeriods;
      if (Math.abs(formData.installment_amount - calculatedInstallmentAmount) > 0.01) {
        setFormData(prev => ({ ...prev, installment_amount: calculatedInstallmentAmount }));
      }
    }
  }, [
    formData.amount,
    formData.downpayment_amount,
    formData.final_payment_amount,
    formData.installment_period,
    formData.payment_plan,
    formData.installment_amount,
    formData.platform_fee_type,
    formData.afternic_ns_pointed,
    formData.afternic_premium_addon,
    formData.atom_commission_tier,
    formData.atom_no_coin,
    formData.atom_custom_commission_rate,
    formData.user_input_surcharge_rate,
  ]);

  // 只有 transfer 的金额可以是 0（免费 push / 同注册商内部转移），与
  // validateTransaction 的口径保持一致。
  const allowsZeroAmount = formData.type === 'transfer';

  const performSave = async ({ keepOpen }: { keepOpen: boolean }) => {
    if (isSubmitting) return;
    if (!formData.domain_id) {
      setDomainDropdownOpen(true);
      return;
    }

    // 跨字段日期校验：交易日期不应早于关联域名的购买日期
    if (selectedDomain?.purchase_date && formData.date) {
      const txDate = new Date(formData.date);
      const purDate = new Date(selectedDomain.purchase_date);
      if (!isNaN(txDate.getTime()) && !isNaN(purDate.getTime()) && txDate < purDate) {
        setSubmitError(t('validation.transaction.dateBeforeDomainPurchase'));
        return;
      }
    }

    const calculatedNetAmount = formData.amount - formData.platform_fee;
    const clampRenewalYears = Math.min(
      10,
      Math.max(1, Math.floor(Number(formData.renewal_period_years)) || 1)
    );
    // transfer：0 → null（不延长到期）；1–10 → 延长对应年数
    const transferExtendYears = Math.min(
      10,
      Math.max(0, Math.floor(Number(formData.renewal_period_years)) || 0)
    );
    const finalFormData = {
      ...formData,
      currency: 'USD',
      net_amount: calculatedNetAmount,
      user_id: '',
      created_at: '',
      updated_at: '',
      ...(formData.type === 'renew'
        ? {
            renewal_period_years: clampRenewalYears,
            renewal_years_use_custom: formData.renewal_years_use_custom
          }
        : formData.type === 'transfer'
          ? {
              renewal_period_years: transferExtendYears > 0 ? transferExtendYears : null,
              renewal_years_use_custom: undefined
            }
          : {
              renewal_period_years: null,
              renewal_years_use_custom: undefined
            })
    };

    const finalFormDataClean = finalFormData;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      // 须等待持久化完成再关窗；否则用户刷新时 saveData 可能仍在遍历域名，交易尚未 insert
      await Promise.resolve(onSave(finalFormDataClean));

      if (finalFormDataClean.type === 'sell' && onSaleComplete) {
        const sold = domains.find((d) => d.id === finalFormDataClean.domain_id);
        if (sold) {
          onSaleComplete(finalFormDataClean, sold);
        }
      }

      if (keepOpen) {
        // 重置表单但保留当前域名，方便连续录入同一域名的多笔交易
        setFormData(buildEmptyFormData({ preserveDomainId: formData.domain_id }));
      } else {
        onClose();
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performSave({ keepOpen: false });
  };

  const transactionTypes: Array<{ value: TransactionWithRequiredFields['type']; label: string }> = [
    { value: 'buy', label: t('transaction.buy') },
    { value: 'renew', label: t('transaction.renew') },
    { value: 'sell', label: t('transaction.sell') },
    { value: 'transfer', label: t('transaction.transfer') },
    { value: 'fee', label: t('transaction.fee') },
    { value: 'marketing', label: t('transaction.marketing') },
    { value: 'advertising', label: t('transaction.advertising') }
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={transaction ? t('transaction.editTransaction') : t('transaction.addNewTransaction')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-stone-900">
            {transaction ? t('transaction.editTransaction') : t('transaction.addNewTransaction')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600"
            aria-label={t('common.close')}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div ref={domainPickerRef}>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t('transaction.domain')} *
            </label>
            <div className="relative">
              {selectedDomain ? (
                <div className="flex items-center gap-2 rounded-md border border-stone-300 bg-stone-50 px-3 py-2">
                  <span className="flex-1 font-medium text-stone-900">{selectedDomain.domain_name}</span>
                  <span className="text-xs text-stone-500">
                    ({selectedDomain.status === 'active' ? t('transaction.domainStatusActive') : selectedDomain.status === 'for_sale' ? t('transaction.domainStatusForSale') : t('transaction.domainStatusSold')})
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, domain_id: '' })}
                    className="text-stone-400 hover:text-stone-600"
                    aria-label={t('common.close')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex rounded-md border border-stone-300 focus-within:ring-2 focus-within:ring-blue-500">
                    <span className="flex items-center pl-3 text-stone-400">
                      <Search className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      value={domainSearch}
                      onChange={(e) => {
                        setDomainSearch(e.target.value);
                        setDomainDropdownOpen(true);
                      }}
                      onFocus={() => setDomainDropdownOpen(true)}
                      placeholder={t('transaction.searchDomainPlaceholder')}
                      className="flex-1 min-w-0 py-2 px-3 border-0 focus:ring-0 focus:outline-none rounded-r-md"
                    />
                    <button
                      type="button"
                      onClick={() => setDomainDropdownOpen((v) => !v)}
                      className="pr-2 text-stone-400 hover:text-stone-600"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  {domainDropdownOpen && (
                    <ul
                      className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-stone-200 bg-white shadow-lg py-1"
                      role="listbox"
                    >
                      {filteredDomains.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-stone-500">{t('transaction.selectDomain')}</li>
                      ) : (
                        filteredDomains.map((domain) => (
                          <li
                            key={domain.id}
                            role="option"
                            aria-selected={formData.domain_id === domain.id}
                            onClick={() => {
                              setFormData({ ...formData, domain_id: domain.id });
                              setDomainSearch('');
                              setDomainDropdownOpen(false);
                            }}
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-stone-100 flex justify-between items-center"
                          >
                            <span className="font-medium text-stone-900 truncate">{domain.domain_name}</span>
                            <span className="text-xs text-stone-500 shrink-0 ml-2">
                              {domain.status === 'active' ? t('transaction.domainStatusActive') : domain.status === 'for_sale' ? t('transaction.domainStatusForSale') : t('transaction.domainStatusSold')}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="transaction-form-type" className="block text-sm font-medium text-stone-700 mb-2">
                {t('transaction.type')} *
              </label>
              <select
                id="transaction-form-type"
                required
                value={formData.type}
                onChange={(e) => {
                  const nextType = e.target.value as TransactionWithRequiredFields['type'];
                  setFormData({
                    ...formData,
                    type: nextType,
                    // 切到 transfer 时把年数清零：转移默认不延长到期，得用户显式填。
                    // 切回 renew 时下方的 effect 会按域名续费周期补回默认值。
                    ...(nextType === 'transfer' ? { renewal_period_years: 0 } : {})
                  });
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <h4 className="text-sm font-medium text-blue-900">{t('transaction.renewalCostHistory')}</h4>
                    <button
                      type="button"
                      onClick={() => setShowCostHistory(!showCostHistory)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {showCostHistory ? t('transaction.hideHistory') : t('transaction.showHistory')}
                    </button>
                  </div>

                  {suggestedRenewalCost && (
                    <div className="mb-2">
                      <span className="text-sm text-blue-700">
                        {t('transaction.suggestedCost')}: {formatCurrencyAmount(suggestedRenewalCost, formData.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, amount: suggestedRenewalCost })}
                        className="ml-2 text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        {t('transaction.useSuggested')}
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
                        <p className="text-xs text-blue-600">{t('transaction.noRenewalHistory')}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {formData.type === 'renew' && formData.domain_id && (
              <div className="md:col-span-2 space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <label className="flex items-center gap-2 text-sm text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.renewal_years_use_custom}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        renewal_years_use_custom: e.target.checked
                      }))
                    }
                    className="rounded border-stone-300"
                  />
                  {t('transaction.renewUseCustomYears')}
                </label>
                {!formData.renewal_years_use_custom && selectedDomain ? (
                  <p className="text-xs text-stone-600">
                    {t('transaction.renewUseDomainCycle').replace(
                      '{years}',
                      String(Math.min(10, Math.max(1, selectedDomain.renewal_cycle || 1)))
                    )}
                  </p>
                ) : (
                  <div>
                    <label
                      htmlFor="transaction-renewal-period-years"
                      className="block text-xs font-medium text-stone-600 mb-1"
                    >
                      {t('transaction.renewPeriodYears')}
                    </label>
                    <input
                      id="transaction-renewal-period-years"
                      type="number"
                      min={1}
                      max={10}
                      value={formData.renewal_period_years}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          renewal_period_years: Math.min(
                            10,
                            Math.max(1, parseInt(e.target.value, 10) || 1)
                          )
                        }))
                      }
                      className="w-24 px-2 py-1 border border-stone-300 rounded-md text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {formData.type === 'transfer' && formData.domain_id && (
              <div className="md:col-span-2 space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <label
                  htmlFor="transaction-transfer-extend-years"
                  className="block text-sm font-medium text-stone-800"
                >
                  {t('transaction.transferExtendYears')}
                </label>
                <input
                  id="transaction-transfer-extend-years"
                  type="number"
                  min={0}
                  max={10}
                  value={formData.renewal_period_years}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      renewal_period_years: Math.min(
                        10,
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      )
                    }))
                  }
                  className="w-24 px-2 py-1 border border-stone-300 rounded-md text-sm"
                />
                <p className="text-xs text-stone-600">{t('transaction.transferExtendYearsHint')}</p>
              </div>
            )}

            <DateInput
              label={t('transaction.date')}
              icon={<Calendar className="h-4 w-4" />}
              value={formData.date}
              onChange={(value) => setFormData({ ...formData, date: value })}
              required
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="transaction-form-amount" className="block text-sm font-medium text-stone-700 mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                {t('transaction.amount')} {allowsZeroAmount ? '' : '*'}
              </label>
              <input
                id="transaction-form-amount"
                type="number"
                // transfer 允许 0（免费的 push / 同注册商内部转移）；其它类型
                // 空值靠 required 挡住，因为 0 会被渲染成空字符串。
                required={!allowsZeroAmount}
                min="0"
                step="0.01"
                value={allowsZeroAmount || formData.amount !== 0 ? formData.amount : ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              {formData.type === 'renew' && (
                <p className="mt-1 text-xs text-stone-500">
                  {t('transaction.renewAmountHint')}
                </p>
              )}
            </div>

            {/* 平台费：百分比与金额双向联动。
                以前只有百分比入口，金额由 amount × pct / 100 反推，于是「固定
                手续费」这种常见形态填不进来 —— 比如 $150,000 的交易收 $250
                Escrow Disbursement Fee，需要 0.1667%，而输入框 step 是 0.01，
                在这个量级上最小粒度就是 $15。现在两个框都能填，改哪个另一个
                跟着算。 */}
            <div>
              <label htmlFor="transaction-form-platform-fee-pct" className="block text-sm font-medium text-stone-700 mb-2">
                {t('transaction.platformFeePercentage')}
              </label>
              <input
                id="transaction-form-platform-fee-pct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.platform_fee_percentage === 0 ? '' : formData.platform_fee_percentage}
                onChange={(e) => {
                  const percentage = parseFloat(e.target.value) || 0;
                  const calculatedFee = (formData.amount * percentage) / 100;
                  setFormData({
                    ...formData,
                    platform_fee_percentage: percentage,
                    platform_fee: calculatedFee
                  });
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="transaction-form-platform-fee-amount" className="block text-sm font-medium text-stone-700 mb-2">
                {t('transaction.platformFeeAmount')}
              </label>
              <input
                id="transaction-form-platform-fee-amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.platform_fee === 0 ? '' : formData.platform_fee}
                onChange={(e) => {
                  const fee = parseFloat(e.target.value) || 0;
                  // 反推百分比只是为了让另一个框显示得上；amount 为 0 时无从反推，
                  // 保留百分比不动，避免出现 NaN / Infinity。
                  // 金额是权威值（net_amount = amount − platform_fee 直接用它），
                  // 百分比只为显示，截到 4 位小数免得框里出现 0.16666666666666666。
                  const percentage =
                    formData.amount > 0
                      ? Math.round((fee / formData.amount) * 100 * 10000) / 10000
                      : formData.platform_fee_percentage;
                  setFormData({
                    ...formData,
                    platform_fee: fee,
                    platform_fee_percentage: percentage,
                  });
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-stone-500">
                {t('transaction.platformFeeAmountHint')}
              </p>
            </div>
          </div>

          {/* 净收入显示 */}
          {formData.type === 'sell' && (
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-800">{t('transaction.netIncomeCalculation')}</p>
                  <p className="text-lg font-semibold text-emerald-900">
                    {formatCurrencyAmount(formData.amount - formData.platform_fee, formData.currency)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {t('transaction.totalAmount')}: {formatCurrencyAmount(formData.amount, formData.currency)} - {t('transaction.platformFeeDesc')}: {formatCurrencyAmount(formData.platform_fee, formData.currency)}
                  </p>
                </div>
                <div className="p-2 bg-emerald-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </div>
          )}

          {formData.type === 'sell' && (
            <InstallmentConfig
              values={formData}
              amount={formData.amount}
              currency={formData.currency}
              platformFeePercentage={formData.platform_fee_percentage}
              paidPeriodsCount={transaction?.receipts?.length ?? 0}
              receivedAmount={
                (formData.downpayment_amount || 0) +
                (transaction?.receipts ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0)
              }
              onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="transaction-form-platform" className="block text-sm font-medium text-stone-700 mb-2">
                {t('transaction.platform')}
              </label>
              <input
                id="transaction-form-platform"
                type="text"
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('transaction.platformPlaceholder')}
                list="transaction-form-platform-list"
                autoComplete="off"
              />
              <datalist id="transaction-form-platform-list">
                {platformSuggestions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="transaction-form-category" className="block text-sm font-medium text-stone-700 mb-2">
                {t('transaction.category')}
              </label>
              <input
                id="transaction-form-category"
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('transaction.categoryPlaceholder')}
                list={categorySuggestions.length > 0 ? 'transaction-form-category-list' : undefined}
                autoComplete="off"
              />
              {categorySuggestions.length > 0 && (
                <datalist id="transaction-form-category-list">
                  {categorySuggestions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              )}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="tax_deductible"
              checked={formData.tax_deductible}
              onChange={(e) => setFormData({ ...formData, tax_deductible: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-stone-300 rounded"
            />
            <label htmlFor="tax_deductible" className="ml-2 block text-sm text-stone-700">
              {t('transaction.taxDeductible')}
            </label>
          </div>

          <div>
            <label htmlFor="transaction-form-receipt-url" className="block text-sm font-medium text-stone-700 mb-2">
              {t('transaction.receiptUrl')}
            </label>
            <input
              id="transaction-form-receipt-url"
              type="url"
              value={formData.receipt_url}
              onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
              className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('transaction.receiptUrlPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="transaction-form-notes" className="block text-sm font-medium text-stone-700 mb-2">
              <FileText className="h-4 w-4 inline mr-1" />
              {t('transaction.notes')}
            </label>
            <textarea
              id="transaction-form-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('transaction.notesPlaceholder')}
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-600" role="alert">
              {submitError}
            </p>
          )}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-stone-600 hover:text-stone-800 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            {!transaction && (
              <button
                type="button"
                onClick={() => void performSave({ keepOpen: true })}
                disabled={isSubmitting}
                className="px-4 py-2 border border-blue-600 text-blue-700 rounded-md hover:bg-blue-50 disabled:opacity-50"
              >
                {t('transaction.saveAndAddAnother')}
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? t('transaction.saving') : transaction ? t('transaction.updateTransaction') : t('transaction.addTransaction')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
