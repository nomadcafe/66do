'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';
import { TransactionWithRequiredFields } from '../../types/dashboard';
import { supabase } from '../../lib/supabase';
import { InstallmentReceiptService } from '../../lib/supabaseService';
import { logger } from '../../lib/logger';

interface AddReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 父 sell 交易（installment）。空则不渲染。 */
  transaction: TransactionWithRequiredFields | null;
  /** 域名展示用（可选）。 */
  domainName?: string;
  /** 用户 ID — 写入 RLS scoped 行。 */
  userId: string;
  /** 写入成功后调用——通常触发 dashboard refresh。 */
  onAdded: () => void | Promise<void>;
}

const todayISODate = () => new Date().toISOString().slice(0, 10);

/** 从已有 receipts 推下一期默认日期：最后一笔 received_date + 1 个月。
 *  没 receipts 用 installment_first_payment_date 或今天。 */
function suggestNextDate(t: TransactionWithRequiredFields | null): string {
  if (!t) return todayISODate();
  const receipts = t.receipts ?? [];
  if (receipts.length > 0) {
    const last = [...receipts].sort((a, b) =>
      a.received_date.localeCompare(b.received_date)
    )[receipts.length - 1];
    const d = new Date(last.received_date);
    if (!Number.isNaN(d.getTime())) {
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().slice(0, 10);
    }
  }
  if (t.installment_first_payment_date) {
    const d = new Date(t.installment_first_payment_date);
    if (!Number.isNaN(d.getTime())) {
      // 没记过任何 receipt 时，第一期就用 installment_first_payment_date 本身。
      return d.toISOString().slice(0, 10);
    }
  }
  return todayISODate();
}

export default function AddReceiptModal({
  isOpen,
  onClose,
  transaction,
  domainName,
  userId,
  onAdded,
}: AddReceiptModalProps) {
  const { t } = useI18nContext();
  const [receivedDate, setReceivedDate] = useState<string>(todayISODate());
  const [amount, setAmount] = useState<number>(0);
  const [periodNo, setPeriodNo] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaults = useMemo(() => {
    const periodCount = transaction?.receipts?.length ?? 0;
    return {
      date: suggestNextDate(transaction),
      amount: transaction?.installment_amount ?? 0,
      periodNo: periodCount + 1,
    };
  }, [transaction]);

  useEffect(() => {
    if (!isOpen) return;
    setReceivedDate(defaults.date);
    setAmount(defaults.amount);
    setPeriodNo(defaults.periodNo);
    setNotes('');
    setError(null);
  }, [isOpen, defaults]);

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

  if (!isOpen || !transaction) return null;

  const handleSubmit = async () => {
    if (!receivedDate) {
      setError(t('transaction.receiptDateRequired'));
      return;
    }
    if (!Number.isFinite(amount) || amount === 0) {
      setError(t('transaction.receiptAmountRequired'));
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const { error: insertError } = await InstallmentReceiptService.createReceiptWithClient(
        supabase,
        {
          transaction_id: transaction.id,
          user_id: userId,
          received_date: receivedDate,
          amount,
          period_no: periodNo > 0 ? periodNo : null,
          notes: notes.trim() || null,
        }
      );
      if (insertError) {
        throw new Error(insertError);
      }
      await onAdded();
      onClose();
    } catch (err) {
      logger.error('Failed to add installment receipt:', err);
      setError(err instanceof Error ? err.message : t('transaction.receiptAddFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const isRefund = amount < 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-receipt-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-6 border-b border-stone-200 bg-gradient-to-b from-emerald-50/40 to-white">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="add-receipt-modal-title" className="text-lg font-semibold text-stone-900">
                {t('transaction.addReceipt')}
              </h3>
              {domainName && (
                <p className="mt-0.5 text-base font-medium text-stone-900 break-all">{domainName}</p>
              )}
              <p className="text-xs text-stone-500 mt-0.5">
                {t('transaction.paidPeriods')}: {transaction.receipts?.length ?? 0} / {transaction.installment_period ?? 0}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            disabled={isProcessing}
            className="shrink-0 -mr-2 -mt-2 p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-900 flex-1">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t('transaction.receiptDate')}
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t('transaction.receiptAmount')} ({transaction.currency || 'USD'})
              </label>
              <input
                type="number"
                step="0.01"
                value={Number.isFinite(amount) ? amount : 0}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                disabled={isProcessing}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  isRefund ? 'border-rose-300 focus:ring-rose-500' : 'border-stone-300 focus:ring-emerald-500'
                }`}
              />
              <p className="text-xs text-stone-500 mt-1">{t('transaction.refundHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t('transaction.receiptPeriodNo')}
              </label>
              <input
                type="number"
                min={0}
                value={periodNo === 0 ? '' : periodNo}
                onChange={(e) => setPeriodNo(parseInt(e.target.value) || 0)}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t('transaction.receiptNotes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isProcessing}
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-stone-200 bg-stone-50">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className={`px-6 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 disabled:opacity-50 ${
              isRefund ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('common.saving')}</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>{isRefund ? t('transaction.recordRefund') : t('transaction.recordReceipt')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
