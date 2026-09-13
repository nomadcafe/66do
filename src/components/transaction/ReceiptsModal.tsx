'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, DollarSign, AlertCircle, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';
import { TransactionWithRequiredFields } from '../../types/dashboard';
import { supabase } from '../../lib/supabase';
import { validateInstallmentReceipt, translateValidationMessages } from '../../lib/validation';
import { logger } from '../../lib/logger';
import { localCalendarDateISO, parseLocalCalendarDate } from '../../lib/localCalendarDate';
import DateInput from '../ui/DateInput';
import NumberInput from '../ui/NumberInput';
import { useModalA11y } from '../../hooks/useModalA11y';

interface ReceiptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 父 sell 交易（installment）。空则不渲染。 */
  transaction: TransactionWithRequiredFields | null;
  /** 域名展示用（可选）。 */
  domainName?: string;
  /** 增 / 改 / 删任意一种成功后调用——通常触发 dashboard refresh。 */
  onChanged: () => void | Promise<void>;
}

// 本地日历日。toISOString() 取的是 UTC 日 —— 在 UTC+8，早上 8 点之前
// 「今天」会变成昨天，收款记录默认就录错一天。
const todayISODate = () => localCalendarDateISO();

/** 从已有 receipts 推下一期默认日期：最后一笔 received_date + 1 个月。
 *  没 receipts 用 installment_first_payment_date 或今天。 */
function suggestNextDate(t: TransactionWithRequiredFields | null): string {
  if (!t) return todayISODate();
  const receipts = t.receipts ?? [];
  if (receipts.length > 0) {
    const last = [...receipts].sort((a, b) =>
      a.received_date.localeCompare(b.received_date)
    )[receipts.length - 1];
    // 'YYYY-MM-DD' 必须按本地日历日解析：new Date() 走 ISO 规则当 UTC 午夜，
    // 而 setMonth / getMonth 读的是本地值，两套口径混用会在负偏移时区错月
    // （'2026-03-01' 在 EST 下解析成 2 月 28 日，+1 月给出 3 月 28 日）。
    const d = parseLocalCalendarDate(last.received_date);
    if (d) {
      d.setMonth(d.getMonth() + 1);
      return localCalendarDateISO(d);
    }
  }
  if (t.installment_first_payment_date) {
    const d = parseLocalCalendarDate(t.installment_first_payment_date);
    if (d) {
      // 没记过任何 receipt 时，第一期就用 installment_first_payment_date 本身。
      return localCalendarDateISO(d);
    }
  }
  return todayISODate();
}

export default function ReceiptsModal({
  isOpen,
  onClose,
  transaction,
  domainName,
  onChanged,
}: ReceiptsModalProps) {
  const { t } = useI18nContext();
  const [receivedDate, setReceivedDate] = useState<string>(todayISODate());
  const [amount, setAmount] = useState<number>(0);
  const [periodNo, setPeriodNo] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 非空表示正在编辑这条收款，空表示新增 */
  const [editingId, setEditingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const receipts = useMemo(
    () => [...(transaction?.receipts ?? [])].sort((a, b) => a.received_date.localeCompare(b.received_date)),
    [transaction]
  );

  const defaults = useMemo(() => {
    const periodCount = transaction?.receipts?.length ?? 0;
    return {
      date: suggestNextDate(transaction),
      amount: transaction?.installment_amount ?? 0,
      periodNo: periodCount + 1,
    };
  }, [transaction]);

  const resetToNew = useCallback(() => {
    setEditingId(null);
    setReceivedDate(defaults.date);
    setAmount(defaults.amount);
    setPeriodNo(defaults.periodNo);
    setNotes('');
    setError(null);
  }, [defaults]);

  useEffect(() => {
    if (!isOpen) return;
    resetToNew();
    // 只在打开时重置。resetToNew 依赖 defaults，而 defaults 会随 transaction
    // 刷新而变——若把它列进依赖，每次增删收款后正在编辑的表单会被冲掉。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  useModalA11y(panelRef, isOpen && !!transaction);

  if (!isOpen || !transaction) return null;

  /** 收款写入全部走 /api/installment-receipts —— 服务端会再校验一遍，并确认
   *  父交易确实属于当前用户（RLS 只保证 user_id 列是自己的，拦不住把收款挂到
   *  别人的 transaction_id 上）。 */
  const authedFetch = async (url: string, init: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    };
    if (session?.refresh_token) headers['X-Refresh-Token'] = session.refresh_token;
    return fetch(url, { ...init, headers });
  };

  const readError = async (response: Response, fallbackKey: string) => {
    const body = await response.json().catch(() => ({}));
    const details = Array.isArray(body?.details)
      ? translateValidationMessages(body.details, t).join('; ')
      : body?.details || body?.error;
    return details || t(fallbackKey);
  };

  const handleSubmit = async () => {
    const receipt = {
      transaction_id: transaction.id,
      received_date: receivedDate,
      amount,
      period_no: periodNo > 0 ? periodNo : null,
      notes: notes.trim() || null,
    };

    // 客户端先拦一道，省掉一次必然失败的往返；服务端跑的是同一个函数
    const validation = validateInstallmentReceipt(receipt);
    if (!validation.valid) {
      setError(translateValidationMessages(validation.errors, t).join('; '));
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const response = editingId
        ? await authedFetch(`/api/installment-receipts/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(receipt),
          })
        : await authedFetch('/api/installment-receipts', {
            method: 'POST',
            body: JSON.stringify(receipt),
          });

      if (!response.ok) {
        throw new Error(
          await readError(response, editingId ? 'transaction.receiptUpdateFailed' : 'transaction.receiptAddFailed')
        );
      }

      await onChanged();
      // 编辑完回到「新增」态并留在弹窗里，方便接着录下一期；新增则沿用原来的
      // 「加完即关」行为。
      if (editingId) resetToNew();
      else onClose();
    } catch (err) {
      logger.error('Failed to save installment receipt:', err);
      setError(err instanceof Error ? err.message : t('transaction.receiptAddFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (receipt: NonNullable<TransactionWithRequiredFields['receipts']>[number]) => {
    setEditingId(receipt.id);
    setReceivedDate(receipt.received_date.slice(0, 10));
    setAmount(Number(receipt.amount));
    setPeriodNo(receipt.period_no ?? 0);
    setNotes(receipt.notes ?? '');
    setError(null);
  };

  const handleDelete = async (receiptId: string) => {
    if (!window.confirm(t('transaction.confirmDeleteReceipt'))) return;

    setIsProcessing(true);
    setError(null);
    try {
      const response = await authedFetch(`/api/installment-receipts/${receiptId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await readError(response, 'transaction.receiptDeleteFailed'));
      }
      await onChanged();
      // 删掉的正是在编辑的那条：表单回到新增态，否则会 PUT 到一个已删除的 id
      if (editingId === receiptId) resetToNew();
    } catch (err) {
      logger.error('Failed to delete installment receipt:', err);
      setError(err instanceof Error ? err.message : t('transaction.receiptDeleteFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const isRefund = amount < 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3 p-6 border-b border-stone-200 bg-gradient-to-b from-emerald-50/40 to-white">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="receipts-modal-title" className="text-lg font-semibold text-stone-900">
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

          {/* 已录收款：此前完全没有列表，录错一笔在界面上无法纠正 */}
          <div>
            <h4 className="text-sm font-medium text-stone-700 mb-2">
              {t('transaction.receiptsList')}
            </h4>
            {receipts.length === 0 ? (
              <p className="text-sm text-stone-500 py-2">{t('transaction.noReceipts')}</p>
            ) : (
              <ul className="divide-y divide-stone-200 border border-stone-200 rounded-lg max-h-48 overflow-y-auto">
                {receipts.map((receipt) => (
                  <li
                    key={receipt.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm ${
                      editingId === receipt.id ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-stone-900 tabular-nums">{receipt.received_date.slice(0, 10)}</span>
                        <span
                          className={`font-medium tabular-nums ${
                            Number(receipt.amount) < 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {Number(receipt.amount).toLocaleString(undefined, {
                            style: 'currency',
                            currency: transaction.currency || 'USD',
                          })}
                        </span>
                        {receipt.period_no != null && (
                          <span className="text-xs text-stone-500">#{receipt.period_no}</span>
                        )}
                      </div>
                      {receipt.notes && (
                        <p className="text-xs text-stone-500 truncate">{receipt.notes}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEdit(receipt)}
                      disabled={isProcessing}
                      aria-label={`${t('common.edit')} ${receipt.received_date.slice(0, 10)}`}
                      className="shrink-0 p-1.5 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(receipt.id)}
                      disabled={isProcessing}
                      aria-label={`${t('common.delete')} ${receipt.received_date.slice(0, 10)}`}
                      className="shrink-0 p-1.5 rounded text-stone-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {editingId && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <span className="text-sm text-emerald-900">{t('transaction.editingReceipt')}</span>
              <button
                type="button"
                onClick={resetToNew}
                disabled={isProcessing}
                className="text-sm font-medium text-emerald-800 underline disabled:opacity-50"
              >
                {t('transaction.switchToAddReceipt')}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <DateInput
                label={t('transaction.receiptDate')}
                value={receivedDate}
                onChange={setReceivedDate}
                className="w-full"
                inputClassName="rounded-lg focus:ring-emerald-500"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t('transaction.receiptAmount')} ({transaction.currency || 'USD'})
              </label>
              <NumberInput
                // 退款是负数，所以这里不设 min
                value={Number.isFinite(amount) ? amount : 0}
                onChange={(v) => setAmount(v ?? 0)}
                blankWhenZero
                placeholder="0.00"
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
              <NumberInput
                integer
                min={0}
                blankWhenZero
                value={periodNo}
                onChange={(v) => setPeriodNo(v ?? 0)}
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
                <span>
                  {editingId
                    ? t('common.save')
                    : isRefund
                      ? t('transaction.recordRefund')
                      : t('transaction.recordReceipt')}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
