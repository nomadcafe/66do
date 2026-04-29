'use client';

import { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** Text shown in the sticky header. */
  title: ReactNode;
  /** Announced by screen readers. Falls back to the string form of `title`. */
  ariaLabel?: string;
  /** Optional node rendered next to the title, e.g. an icon/subtitle group. */
  headerLeading?: ReactNode;
  /** Extra class on the inner panel (e.g. max-width overrides). */
  panelClassName?: string;
  closeLabel?: string;
  children: ReactNode;
}

/**
 * Shared chrome for the sale-success / domain-share / results-share modals:
 * backdrop click + Esc close, role="dialog", sticky header with X button.
 * Focus-trap is intentionally out of scope; see the share-modal audit notes.
 */
export default function ModalShell({
  isOpen,
  onClose,
  title,
  ariaLabel,
  headerLeading,
  panelClassName = 'bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto',
  closeLabel,
  children,
}: ModalShellProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const computedAriaLabel = ariaLabel ?? (typeof title === 'string' ? title : undefined);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={computedAriaLabel}
    >
      <div
        className={panelClassName}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          {headerLeading ?? (
            <h2 className="text-xl font-semibold text-stone-900">{title}</h2>
          )}
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600"
            aria-label={closeLabel ?? 'Close'}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
