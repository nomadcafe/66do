'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { DomainWithTags } from '../../types/dashboard';
import { useI18nContext } from '../../contexts/I18nProvider';
import { localCalendarDateISO } from '../../lib/localCalendarDate';
import { renewalAmountForYears } from '../../lib/renewalPricing';
import DateInput from '../ui/DateInput';
import NumberInput from '../ui/NumberInput';
import { useModalA11y } from '../../hooks/useModalA11y';

export interface RenewalSubmission {
  renewalYears: number;
  amount: number;
  date: string;
  registrar: string | null;
  notes: string | null;
  updateRenewalCost: boolean;
  createTransferTransaction: boolean;
  transferFee: number;
}

interface RenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: DomainWithTags;
  onRenew: (domain: DomainWithTags, input: RenewalSubmission) => Promise<void>;
}

export default function RenewalModal({ isOpen, onClose, domain, onRenew }: RenewalModalProps) {
  const { t } = useI18nContext();
  const [renewalYears, setRenewalYears] = useState<number>(domain.renewal_cycle || 1);
  // renewal_cost 是「一次续费（cycle 年）」的价，不是每年价——见 renewalPricing。
  const [amount, setAmount] = useState<number>(
    renewalAmountForYears(domain.renewal_cost || 0, domain.renewal_cycle || 1, domain.renewal_cycle || 1)
  );
  const [date, setDate] = useState<string>(localCalendarDateISO());
  const [registrar, setRegistrar] = useState<string>(domain.registrar || '');
  const [notes, setNotes] = useState<string>('');
  const [updateRenewalCost, setUpdateRenewalCost] = useState<boolean>(true);
  const [createTransferTransaction, setCreateTransferTransaction] = useState<boolean>(false);
  const [transferFee, setTransferFee] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const years = domain.renewal_cycle || 1;
    setRenewalYears(years);
    setAmount(renewalAmountForYears(domain.renewal_cost || 0, domain.renewal_cycle || 1, years));
    setDate(localCalendarDateISO());
    setRegistrar(domain.registrar || '');
    setNotes('');
    setUpdateRenewalCost(true);
    setCreateTransferTransaction(false);
    setTransferFee(0);
    setError(null);
  }, [isOpen, domain]);

  const unitRenewalCost = useMemo(() => {
    if (!renewalYears || renewalYears < 1) return 0;
    return amount / renewalYears;
  }, [amount, renewalYears]);

  // Esc-to-close + body scroll lock while open. (Backdrop-click is handled
  // inline on the overlay's onClick.) Mirrors the DeleteConfirmDialog
  // a11y treatment so the rest of the page can't scroll behind the modal
  // and keyboard users have a way out.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, isProcessing, onClose]);

  useModalA11y(panelRef, isOpen);

  if (!isOpen) return null;

  // 直接计算续费后的信息，避免类型转换问题
  const renewalCycle = renewalYears || domain.renewal_cycle || 1;
  const currentExpiryDate = domain.expiry_date ? new Date(domain.expiry_date) : null;

  // 计算新的到期日期
  let newExpiryDate: Date;
  if (domain.expiry_date) {
    newExpiryDate = new Date(domain.expiry_date);
    newExpiryDate.setFullYear(newExpiryDate.getFullYear() + renewalCycle);
  } else if (domain.purchase_date) {
    newExpiryDate = new Date(domain.purchase_date);
    newExpiryDate.setFullYear(newExpiryDate.getFullYear() + renewalCycle);
    if (domain.renewal_count > 0) {
      newExpiryDate.setFullYear(newExpiryDate.getFullYear() + (domain.renewal_count * renewalCycle));
    }
  } else {
    newExpiryDate = new Date();
    newExpiryDate.setFullYear(newExpiryDate.getFullYear() + renewalCycle);
  }
  
  const renewalCost = amount;
  const newRenewalCount = (domain.renewal_count || 0) + 1;

  const handleRenew = async () => {
    if (!renewalYears || renewalYears < 1) {
      setError(t('renewal.invalidYears') || 'Please select valid renewal years');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Renewal amount must be greater than 0');
      return;
    }
    if (!date) {
      setError('Renewal date is required');
      return;
    }
    if (createTransferTransaction) {
      const toRegistrar = registrar.trim();
      if (!toRegistrar) {
        setError('Please enter new registrar when transfer is enabled');
        return;
      }
      if ((domain.registrar || '').trim().toLowerCase() === toRegistrar.toLowerCase()) {
        setError('New registrar must be different from current registrar');
        return;
      }
      if (transferFee < 0) {
        setError('Transfer fee cannot be negative');
        return;
      }
    }

    setIsProcessing(true);
    setError(null);

    try {
      await onRenew(domain, {
        renewalYears,
        amount,
        date,
        registrar: registrar.trim() ? registrar.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
        updateRenewalCost,
        createTransferTransaction,
        transferFee,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('renewal.renewalFailed') || 'Renewal failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="renewal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => {
        // Click on the backdrop (not bubbled up from inside the panel) closes the modal,
        // but we still respect isProcessing so an in-flight save can't be aborted by a stray click.
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="bg-white rounded-xl shadow-2xl max-w-xl w-full transform transition-all max-h-[calc(100vh-2rem)] overflow-y-auto focus:outline-none"
      >
        {/* Header. Domain name promoted to a chip-style highlight so the user can
            tell at a glance which domain this dialog is for; the previous
            text-stone-500 subtitle was too easy to miss next to the title. */}
        <div className="flex items-start justify-between gap-3 p-6 border-b border-stone-200 bg-gradient-to-b from-teal-50/40 to-white">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-teal-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="renewal-modal-title" className="text-lg font-semibold text-stone-900">
                {t('renewal.renewDomain') || 'Renew Domain'}
              </h3>
              <p className="mt-0.5 text-base font-medium text-stone-900 break-all">
                {domain.domain_name}
              </p>
              {domain.registrar && (
                <p className="text-xs text-stone-500 mt-0.5">{domain.registrar}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close') || 'Close'}
            disabled={isProcessing}
            className="shrink-0 -mr-2 -mt-2 p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">{error}</p>
              </div>
            </div>
          )}

          {/* Current Status */}
          <div className="bg-stone-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-600">
                {t('renewal.currentExpiry') || 'Current Expiry Date'}
              </span>
              <span className="text-sm font-semibold text-stone-900">
                {currentExpiryDate
                  ? currentExpiryDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
                  : t('renewal.noExpiryDate') || 'Not set'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-600">
                {t('renewal.renewalCount') || 'Renewal Count'}
              </span>
              <span className="text-sm font-semibold text-stone-900">
                {domain.renewal_count || 0} {t('renewal.times') || 'times'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-600">
                {t('renewal.renewalCycle') || 'Renewal Cycle'}
              </span>
              <span className="text-sm font-semibold text-stone-900">
                {domain.renewal_cycle || 1} {t('renewal.years') || 'years'}
              </span>
            </div>
          </div>

          {/* Renewal Years Selection */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-3">
              {t('renewal.selectRenewalYears') || 'Select Renewal Years'}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 5].map((years) => (
                <button
                  key={years}
                  onClick={() => {
                    setRenewalYears(years);
                    // 按新年数重算金额。之前点年数只改了 renewalYears、amount 没动，
                    // 导致 1 年费用配 2 年期限的错账。
                    // 注意 renewal_cost 是「一次续费（cycle 年）」的价而不是每年价
                    // ——这里曾经把它当每年价直接乘年数，2 年一续的域名预填会多一倍。
                    const stored = domain.renewal_cost || 0;
                    if (stored > 0) {
                      setAmount(renewalAmountForYears(stored, domain.renewal_cycle || 1, years));
                    }
                  }}
                  disabled={isProcessing}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    renewalYears === years
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {years} {t('renewal.years') || 'Y'}
                </button>
              ))}
            </div>
          </div>

          {/* Unified renewal input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <DateInput
                label="Renewal date"
                value={date}
                onChange={setDate}
                className="w-full"
                inputClassName="rounded-lg focus:ring-teal-500"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Total renewal amount (USD)</label>
              <NumberInput
                min={0}
                blankWhenZero
                placeholder="0.00"
                value={Number.isFinite(amount) ? amount : 0}
                onChange={(v) => setAmount(v ?? 0)}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {createTransferTransaction ? 'New registrar' : 'Registrar (optional)'}
              </label>
              <input
                type="text"
                value={registrar}
                onChange={(e) => setRegistrar(e.target.value)}
                disabled={isProcessing}
                placeholder="e.g. Namecheap"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center mt-7">
              <label className="inline-flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={updateRenewalCost}
                  onChange={(e) => setUpdateRenewalCost(e.target.checked)}
                  disabled={isProcessing}
                  className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                />
                Update current renewal cost to {unitRenewalCost.toFixed(2)} / year
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-stone-700 mb-2">
                <input
                  type="checkbox"
                  checked={createTransferTransaction}
                  onChange={(e) => setCreateTransferTransaction(e.target.checked)}
                  disabled={isProcessing}
                  className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                />
                Create transfer transaction and update registrar
              </label>
            </div>
            {createTransferTransaction && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Transfer fee (USD)</label>
                <NumberInput
                  min={0}
                  blankWhenZero
                  placeholder="0.00"
                  value={Number.isFinite(transferFee) ? transferFee : 0}
                  onChange={(v) => setTransferFee(v ?? 0)}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isProcessing}
                rows={2}
                placeholder="e.g. Transfer promo renewal"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Renewal Preview */}
          {newExpiryDate && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-5 w-5 text-teal-600" />
                <span className="text-sm font-semibold text-teal-900">
                  {t('renewal.renewalPreview') || 'Renewal Preview'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-teal-700">
                  {t('renewal.newExpiryDate') || 'New Expiry Date'}
                </span>
                <span className="text-sm font-semibold text-teal-900">
                  {newExpiryDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-teal-700">
                  {t('renewal.renewalCost') || 'Renewal Cost'}
                </span>
                <span className="text-sm font-semibold text-teal-900">${renewalCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-teal-700">
                  {t('renewal.newRenewalCount') || 'New Renewal Count'}
                </span>
                <span className="text-sm font-semibold text-teal-900">
                  {newRenewalCount} {t('renewal.times') || 'times'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-stone-200 bg-stone-50">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleRenew}
            disabled={isProcessing || !renewalYears}
            className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{t('renewal.processing') || 'Processing...'}</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>{t('renewal.confirmRenewal') || 'Confirm Renewal'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

