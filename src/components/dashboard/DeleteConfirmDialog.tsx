'use client';

import { type RefObject } from 'react';

interface DeleteConfirmDialogProps {
  open: boolean;
  /** Pre-translated dialog title (e.g. "Confirm Delete") */
  title: string;
  /** Pre-translated body — JSX so callers can highlight the entity name */
  description: React.ReactNode;
  /** Pre-translated action label, defaulting to "Delete" */
  confirmLabel: string;
  /** Pre-translated cancel label */
  cancelLabel: string;
  /** id used for aria-labelledby */
  titleId: string;
  /** id used for aria-describedby */
  descriptionId: string;
  cancelRef?: RefObject<HTMLButtonElement | null>;
  confirmRef?: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * Generic destructive-action confirm dialog used by the dashboard for
 * both "delete domain" and "delete transaction". Pulled out of
 * dashboard/page.tsx as part of the P0 refactor — the two prior
 * inline copies were identical apart from the title/body strings and
 * the ref pair.
 */
export default function DeleteConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  titleId,
  descriptionId,
  cancelRef,
  confirmRef,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
        <h3 id={titleId} className="text-base font-semibold text-stone-900">{title}</h3>
        <p id={descriptionId} className="mt-2 text-sm text-stone-600">
          {description}
        </p>
        <div className="flex gap-3 mt-6">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
