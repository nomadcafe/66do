'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { useModalA11y } from '../../hooks/useModalA11y';
import { X, SlidersHorizontal, Database, ShieldCheck } from 'lucide-react';

export type SettingsSection = 'preferences' | 'data' | 'security';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  section: SettingsSection;
  onSectionChange: (s: SettingsSection) => void;
  preferencesNode: ReactNode;
  dataNode: ReactNode;
  securityNode: ReactNode;
  labels: {
    title: string;
    preferences: string;
    data: string;
    security: string;
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
  securityNode,
  labels,
}: SettingsDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // 打开时聚焦、关闭时还回去、锁背景滚动、Tab 不跑出抽屉——都在 hook 里。
  // 初始落点保持在关闭按钮上（data-autofocus），与改造前一致。
  useModalA11y(panelRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
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
      <div
        ref={panelRef}
        className="absolute right-0 top-0 h-full w-full max-w-[640px] bg-stone-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4">
          <h2 id="settings-drawer-title" className="text-base font-semibold text-stone-900">
            {labels.title}
          </h2>
          <button
            data-autofocus
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
            <button
              type="button"
              role="tab"
              aria-selected={section === 'security'}
              onClick={() => onSectionChange('security')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                section === 'security' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              {labels.security}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {section === 'preferences' && preferencesNode}
          {section === 'data' && dataNode}
          {section === 'security' && securityNode}
        </div>
      </div>
    </div>
  );
}
