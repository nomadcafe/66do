'use client';

import { useEffect, useRef } from 'react';

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
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * Generic destructive-action confirm dialog used by the dashboard for
 * both "delete domain" and "delete transaction". Owns its own a11y
 * plumbing: scroll lock while open, Escape closes, Tab traps between
 * the two buttons, the destructive button auto-focuses on open (so
 * Enter naturally confirms — pair with focus-visible ring), focus
 * restores on close.
 */
export default function DeleteConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  titleId,
  descriptionId,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => confirmRef.current?.focus(), 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === 'Tab') {
        const cancel = cancelRef.current;
        const confirm = confirmRef.current;
        if (!cancel || !confirm) return;
        const active = document.activeElement;
        if (e.shiftKey && active === cancel) {
          e.preventDefault();
          confirm.focus();
        } else if (!e.shiftKey && active === confirm) {
          e.preventDefault();
          cancel.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onCancel]);

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
