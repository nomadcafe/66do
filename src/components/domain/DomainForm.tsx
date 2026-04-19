'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Globe, Calendar, DollarSign, Tag, Loader2 } from 'lucide-react';
import { validateDomain, sanitizeDomainData } from '../../lib/validation';
import { localCalendarDateISO } from '../../lib/localCalendarDate';
import { DomainWithTags } from '../../types/dashboard';
import DateInput from '../ui/DateInput';
import { useI18nContext } from '../../contexts/I18nProvider';

// interface Domain {
//   id: string;
//   domain_name: string;
//   registrar: string;
//   purchase_date: string;
//   purchase_cost: number;
//   renewal_cost: number;
//   renewal_cycle: number; // 续费周期（年数）：1, 2, 3等
//   renewal_count: number; // 已续费次数
//   next_renewal_date?: string;
//   expiry_date?: string; // 改为可选字段
//   status: 'active' | 'for_sale' | 'sold' | 'expired';
//   estimated_value: number;
//   tags: string[] | string;
// }

interface DomainFormProps {
  domain?: DomainWithTags;
  isOpen: boolean;
  onClose: () => void;
  onSave: (domain: Omit<DomainWithTags, 'id'>) => void;
}

export default function DomainForm({ domain, isOpen, onClose, onSave }: DomainFormProps) {
  const { t } = useI18nContext();
  const [formData, setFormData] = useState({
    domain_name: '',
    registrar: '',
    purchase_date: '',
    purchase_cost: 0,
    renewal_cost: 0,
    renewal_cycle: 1, // 默认1年续费
    renewal_count: 0, // 默认未续费
    baseline_renewal_as_of: '',
    next_renewal_date: '',
    expiry_date: '',
    status: 'active' as 'active' | 'for_sale' | 'sold' | 'expired',
    estimated_value: 0,
    tags: [] as string[]
  });

  const [tagInput, setTagInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localOpen, setLocalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLocalOpen(isOpen);
  }, [isOpen]);

  // 仅在打开弹窗或切换编辑的域名时用 domain 初始化表单，避免父组件重渲染导致表单被覆盖
  const domainId = domain?.id ?? 'new';
  useEffect(() => {
    if (!isOpen) return;
    setSubmitError(null);
    if (domain) {
      const tagsArray = Array.isArray(domain.tags)
        ? domain.tags
        : typeof domain.tags === 'string'
          ? (() => { try { const p = JSON.parse(domain.tags); return Array.isArray(p) ? p : []; } catch { return []; } })()
          : [];
      setFormData({
        domain_name: domain.domain_name,
        registrar: domain.registrar || '',
        purchase_date: domain.purchase_date || '',
        purchase_cost: domain.purchase_cost || 0,
        renewal_cost: domain.renewal_cost || 0,
        renewal_cycle: domain.renewal_cycle,
        renewal_count: domain.renewal_count,
        baseline_renewal_as_of:
          domain.baseline_renewal_as_of != null
            ? String(domain.baseline_renewal_as_of).slice(0, 10)
            : '',
        next_renewal_date: domain.next_renewal_date || '',
        expiry_date: domain.expiry_date || '',
        status: domain.status as 'active' | 'for_sale' | 'sold' | 'expired',
        estimated_value: domain.estimated_value || 0,
        tags: tagsArray
      });
    } else {
      setFormData({
        domain_name: '',
        registrar: '',
        purchase_date: '',
        purchase_cost: 0,
        renewal_cost: 0,
        renewal_cycle: 1,
        renewal_count: 0,
        baseline_renewal_as_of: localCalendarDateISO(),
        next_renewal_date: '',
        expiry_date: '',
        status: 'active' as 'active' | 'for_sale' | 'sold' | 'expired',
        estimated_value: 0,
        tags: []
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在被编辑域名 id 或弹窗开关变化时同步，不随 domain 引用变化重置
  }, [isOpen, domainId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[DomainForm] handleSubmit fired');

    const sanitizedData = sanitizeDomainData(formData);
    const validation = validateDomain(sanitizedData);

    if (!validation.valid) {
      console.log('[DomainForm] validation failed', validation.errors);
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors([]);
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      console.log('[DomainForm] calling onSave');
      await Promise.resolve(onSave(sanitizedData as Omit<DomainWithTags, 'id'>));
      console.log('[DomainForm] onSave resolved, closing');
      setLocalOpen(false);
      onClose();
    } catch (err) {
      console.log('[DomainForm] onSave threw', err);
      setSubmitError(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag) {
      setFormData((prev) =>
        prev.tags.includes(tag) ? prev : { ...prev, tags: [...prev.tags, tag] }
      );
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleClose = () => {
    console.log('[DomainForm] handleClose fired');
    setLocalOpen(false);
    onClose();
  };

  if (!localOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 flex justify-end"
      style={{ zIndex: 99999 }}
      role="dialog"
      aria-modal="true"
      aria-label={domain ? t('dashboard.domainFormTitleEdit') : t('dashboard.domainFormTitleAdd')}
    >
      {/* Backdrop — click to close. As a div sibling of the panel below; the panel's
          explicit z-10 keeps it above the backdrop so clicks on form fields and buttons
          hit them, not the backdrop. */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={handleClose}
        aria-hidden
      />
      <div
        className="relative z-10 bg-white w-full max-w-xl h-full overflow-y-auto shadow-xl flex flex-col"
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            {domain ? t('dashboard.domainFormTitleEdit') : t('dashboard.domainFormTitleAdd')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 cursor-pointer"
            aria-label={t('common.close')}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form
          id="domain-form"
          onSubmit={handleSubmit}
          className="p-6 space-y-6"
          aria-describedby={validationErrors.length > 0 ? 'domain-form-errors' : undefined}
        >
          {/* 提交/保存错误 */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm" role="alert">
              {submitError}
            </div>
          )}
          {/* 验证错误显示 */}
          {validationErrors.length > 0 && (
            <div id="domain-form-errors" className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
              <h3 className="text-red-800 font-medium mb-2">{t('common.formErrorsHeading')}</h3>
              <ul className="text-red-700 text-sm space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="domain-form-domain_name" className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="h-4 w-4 inline mr-1" />
                {t('dashboard.domainNameLabel')} *
              </label>
              <input
                id="domain-form-domain_name"
                type="text"
                required
                value={formData.domain_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, domain_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('dashboard.domainNamePlaceholder')}
                aria-invalid={validationErrors.some((e) => e.toLowerCase().includes('domain'))}
              />
            </div>

            <div>
              <label htmlFor="domain-form-registrar" className="block text-sm font-medium text-gray-700 mb-2">
                {t('dashboard.registrarLabel')}
              </label>
              <input
                id="domain-form-registrar"
                type="text"
                value={formData.registrar}
                onChange={(e) => setFormData((prev) => ({ ...prev, registrar: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('dashboard.registrarPlaceholder')}
              />
            </div>

            <DateInput
              label={`${t('dashboard.purchaseDateLabel')} *`}
              icon={<Calendar className="h-4 w-4" />}
              value={formData.purchase_date}
              onChange={(value) => setFormData((prev) => ({ ...prev, purchase_date: value }))}
              required
              className="w-full"
            />

            <div className="md:col-span-2 space-y-1">
              <DateInput
                label={t('dashboard.expiryDateLabel')}
                icon={<Calendar className="h-4 w-4" />}
                value={formData.expiry_date}
                onChange={(value) => setFormData((prev) => ({ ...prev, expiry_date: value }))}
                className="w-full max-w-md"
              />
              <p className="text-xs text-gray-500">{t('dashboard.expiryDateOptionalHint')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                {t('dashboard.purchaseCostLabel')} *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.purchase_cost}
                onChange={(e) => setFormData((prev) => ({ ...prev, purchase_cost: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                {t('dashboard.renewalCostLabel')}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.renewal_cost}
                onChange={(e) => setFormData((prev) => ({ ...prev, renewal_cost: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="h-4 w-4 inline mr-1" />
            {t('dashboard.renewalCycleYears')}
          </label>
          <select
            value={formData.renewal_cycle}
            onChange={(e) => setFormData((prev) => ({ ...prev, renewal_cycle: parseInt(e.target.value) || 1 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>{t('dashboard.renewalCycle1Year')}</option>
            <option value={2}>{t('dashboard.renewalCycle2Years')}</option>
            <option value={3}>{t('dashboard.renewalCycle3Years')}</option>
            <option value={5}>{t('dashboard.renewalCycle5Years')}</option>
            <option value={10}>{t('dashboard.renewalCycle10Years')}</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {t('dashboard.renewalCycleHelp')}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="h-4 w-4 inline mr-1" />
            {t('dashboard.renewalCountLabel')}
          </label>
          <input
            type="number"
            min="0"
            value={formData.renewal_count}
            onChange={(e) => setFormData((prev) => ({ ...prev, renewal_count: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('dashboard.renewalCountPlaceholder')}
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('dashboard.renewalCountHelp')}
          </p>
        </div>

            <DateInput
              label={t('dashboard.baselineRenewalAsOfLabel')}
              icon={<Calendar className="h-4 w-4" />}
              value={formData.baseline_renewal_as_of}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, baseline_renewal_as_of: value }))
              }
              className="w-full md:col-span-2"
            />
            <p className="text-xs text-gray-500 md:col-span-2 -mt-4">
              {t('dashboard.baselineRenewalAsOfHelp')}
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                {t('dashboard.estimatedValueLabel')}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.estimated_value}
                onChange={(e) => setFormData((prev) => ({ ...prev, estimated_value: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('dashboard.statusLabel')}
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'for_sale' | 'sold' | 'expired' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">{t('common.active')}</option>
                <option value="for_sale">{t('common.forSale')}</option>
                <option value="sold">{t('common.sold')}</option>
                <option value="expired">{t('common.expired')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag className="h-4 w-4 inline mr-1" />
              {t('dashboard.tagsLabel')}
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('dashboard.addTagPlaceholder')}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                {t('dashboard.add')}
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 cursor-pointer"
            >
              {t('dashboard.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isSubmitting ? (domain ? t('dashboard.updating') : t('dashboard.adding')) : (domain ? t('dashboard.updateDomain') : t('dashboard.addDomain'))}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
