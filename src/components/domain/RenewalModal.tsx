'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { DomainWithTags } from '../../types/dashboard';
import { useI18nContext } from '../../contexts/I18nProvider';

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
  const [amount, setAmount] = useState<number>((domain.renewal_cost || 0) * (domain.renewal_cycle || 1));
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [registrar, setRegistrar] = useState<string>(domain.registrar || '');
  const [notes, setNotes] = useState<string>('');
  const [updateRenewalCost, setUpdateRenewalCost] = useState<boolean>(true);
  const [createTransferTransaction, setCreateTransferTransaction] = useState<boolean>(false);
  const [transferFee, setTransferFee] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const years = domain.renewal_cycle || 1;
    setRenewalYears(years);
    setAmount((domain.renewal_cost || 0) * years);
    setDate(new Date().toISOString().split('T')[0]);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full mx-4 transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('renewal.renewDomain') || 'Renew Domain'}
              </h3>
              <p className="text-sm text-gray-500">{domain.domain_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isProcessing}
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
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                {t('renewal.currentExpiry') || 'Current Expiry Date'}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {currentExpiryDate
                  ? currentExpiryDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
                  : t('renewal.noExpiryDate') || 'Not set'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                {t('renewal.renewalCount') || 'Renewal Count'}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {domain.renewal_count || 0} {t('renewal.times') || 'times'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                {t('renewal.renewalCycle') || 'Renewal Cycle'}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {domain.renewal_cycle || 1} {t('renewal.years') || 'years'}
              </span>
            </div>
          </div>

          {/* Renewal Years Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('renewal.selectRenewalYears') || 'Select Renewal Years'}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 5].map((years) => (
                <button
                  key={years}
                  onClick={() => setRenewalYears(years)}
                  disabled={isProcessing}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    renewalYears === years
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Renewal date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total renewal amount (USD)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={Number.isFinite(amount) ? amount : 0}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {createTransferTransaction ? 'New registrar' : 'Registrar (optional)'}
              </label>
              <input
                type="text"
                value={registrar}
                onChange={(e) => setRegistrar(e.target.value)}
                disabled={isProcessing}
                placeholder="e.g. Namecheap"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex items-center mt-7">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={updateRenewalCost}
                  onChange={(e) => setUpdateRenewalCost(e.target.checked)}
                  disabled={isProcessing}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Update current renewal cost to {unitRenewalCost.toFixed(2)} / year
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 mb-2">
                <input
                  type="checkbox"
                  checked={createTransferTransaction}
                  onChange={(e) => setCreateTransferTransaction(e.target.checked)}
                  disabled={isProcessing}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Create transfer transaction and update registrar
              </label>
            </div>
            {createTransferTransaction && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transfer fee (USD)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(transferFee) ? transferFee : 0}
                  onChange={(e) => setTransferFee(parseFloat(e.target.value) || 0)}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isProcessing}
                rows={2}
                placeholder="e.g. Transfer promo renewal"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Renewal Preview */}
          {newExpiryDate && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-semibold text-green-900">
                  {t('renewal.renewalPreview') || 'Renewal Preview'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700">
                  {t('renewal.newExpiryDate') || 'New Expiry Date'}
                </span>
                <span className="text-sm font-semibold text-green-900">
                  {newExpiryDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700">
                  {t('renewal.renewalCost') || 'Renewal Cost'}
                </span>
                <span className="text-sm font-semibold text-green-900">${renewalCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700">
                  {t('renewal.newRenewalCount') || 'New Renewal Count'}
                </span>
                <span className="text-sm font-semibold text-green-900">
                  {newRenewalCount} {t('renewal.times') || 'times'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleRenew}
            disabled={isProcessing || !renewalYears}
            className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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

