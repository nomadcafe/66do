'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { X, SlidersHorizontal, Database } from 'lucide-react';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  section: 'preferences' | 'data';
  onSectionChange: (s: 'preferences' | 'data') => void;
  preferencesNode: ReactNode;
  dataNode: ReactNode;
  labels: {
    title: string;
    preferences: string;
    data: string;
    close: string;
  };
}

/**
 * Slide-over right-edge drawer for app settings.
 * Keeps Settings out of the main tab bar and a single click away from anywhere.
 */
export default function SettingsDrawer({
  isOpen,
  onClose,
  section,
  onSectionChange,
  preferencesNode,
  dataNode,
  labels,
}: SettingsDrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-drawer-title"
      className="fixed inset-0 z-50"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={labels.close}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 transition-opacity"
      />

      {/* Drawer panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-[640px] bg-stone-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4">
          <h2 id="settings-drawer-title" className="text-base font-semibold text-stone-900">
            {labels.title}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="text-stone-500 hover:text-stone-800 p-1.5 rounded-lg hover:bg-stone-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section toggle */}
        <div className="border-b border-stone-200 bg-white px-5 pt-3 pb-3">
          <div role="tablist" className="inline-flex gap-1 p-1 rounded-xl border border-stone-200 bg-stone-50">
            <button
              type="button"
              role="tab"
              aria-selected={section === 'preferences'}
              onClick={() => onSectionChange('preferences')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                section === 'preferences' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {labels.preferences}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === 'data'}
              onClick={() => onSectionChange('data')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                section === 'data' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Database className="h-4 w-4" />
              {labels.data}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {section === 'preferences' ? preferencesNode : dataNode}
        </div>
      </div>
    </div>
  );
}
