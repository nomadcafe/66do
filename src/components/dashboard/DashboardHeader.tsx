'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AtSign, FileText, Plus, Share2, Settings, LogOut, User, MoreVertical,
} from 'lucide-react';

interface DashboardHeaderProps {
  /** Pre-translated label bag from the page (avoids importing useI18nContext here). */
  labels: {
    chinese: string;
    english: string;
    selectLanguage: string;
    addInvestment: string;
    addTransaction: string;
    shareResults: string;
    settings: string;
    signOut: string;
    more: string;
  };
  email?: string | null;
  locale: 'zh' | 'en';
  onSetLocale: (l: 'zh' | 'en') => void;
  onAddDomain: () => void;
  onAddTransaction: () => void;
  onShare: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void | Promise<void>;
}

/**
 * Sticky top header for the dashboard, both desktop and mobile variants.
 * Pulled out of dashboard/page.tsx as part of the P0 trim. The mobile
 * overflow menu manages its own open state internally; everything else
 * is parent-controlled.
 */
export default function DashboardHeader({
  labels,
  email,
  locale,
  onSetLocale,
  onAddDomain,
  onAddTransaction,
  onShare,
  onOpenSettings,
  onSignOut,
}: DashboardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  // Click-outside / Escape closes the mobile overflow menu.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen]);

  const initial = email ? email.charAt(0).toUpperCase() : null;
  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await onSignOut();
  };

  return (
    <>
      {/* Desktop Header */}
      <header className="hidden lg:block border-b border-stone-200/60 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm shadow-stone-200/50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center gap-3 group" aria-label="Domain.Financial">
              <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center text-white shadow-sm group-hover:bg-stone-700 transition-colors">
                <AtSign className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold tracking-tight leading-tight">
                <span className="text-stone-800">Domain</span>
                <span className="text-teal-600">.Financial</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <div
                role="group"
                aria-label={labels.selectLanguage}
                className="flex items-center gap-0.5 p-1 rounded-xl border border-stone-200 bg-stone-50/80"
              >
                <button
                  type="button"
                  onClick={() => onSetLocale('zh')}
                  aria-pressed={locale === 'zh'}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                    locale === 'zh' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {labels.chinese}
                </button>
                <button
                  type="button"
                  onClick={() => onSetLocale('en')}
                  aria-pressed={locale === 'en'}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                    locale === 'en' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {labels.english}
                </button>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200/80 bg-stone-50/80">
                <div className="w-8 h-8 bg-stone-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {initial ?? <User className="h-4 w-4" />}
                </div>
                <div className="hidden xl:block">
                  <span className="text-sm font-medium text-stone-900 block leading-tight">{email?.split('@')[0] || 'User'}</span>
                  <span className="text-xs text-stone-500 block leading-tight truncate max-w-[140px]">{email || ''}</span>
                </div>
              </div>
              <button
                onClick={onAddTransaction}
                className="border border-stone-300 text-stone-700 px-4 py-2.5 rounded-xl hover:bg-stone-100 flex items-center gap-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <FileText size={18} />
                <span>{labels.addTransaction}</span>
              </button>
              <button
                onClick={onAddDomain}
                className="bg-teal-600 text-white px-5 py-2.5 rounded-xl hover:bg-teal-700 flex items-center gap-2 text-sm font-medium shadow-sm shadow-teal-600/20 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <Plus size={18} />
                <span>{labels.addInvestment}</span>
              </button>
              <button
                onClick={onShare}
                aria-label={labels.shareResults}
                title={labels.shareResults}
                className="text-stone-500 hover:text-stone-800 p-2.5 rounded-xl hover:bg-stone-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <Share2 size={18} />
              </button>
              <button
                onClick={onOpenSettings}
                aria-label={labels.settings}
                title={labels.settings}
                className="text-stone-500 hover:text-stone-800 p-2.5 rounded-xl hover:bg-stone-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={onSignOut}
                className="text-stone-500 hover:text-stone-800 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-stone-100 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <LogOut size={18} />
                <span>{labels.signOut}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="lg:hidden border-b border-stone-200/60 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm shadow-stone-200/50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Domain.Financial">
              <div className="w-9 h-9 bg-stone-800 rounded-xl flex items-center justify-center text-white shadow-sm">
                <AtSign className="h-5 w-5" />
              </div>
              <span className="text-base font-semibold tracking-tight leading-tight">
                <span className="text-stone-800">Domain</span>
                <span className="text-teal-600">.Financial</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-stone-700 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {initial ?? <User className="h-4 w-4" />}
              </div>
              <button
                onClick={onAddDomain}
                aria-label={labels.addInvestment}
                className="bg-teal-600 text-white p-2.5 rounded-xl hover:bg-teal-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <Plus size={18} />
              </button>
              <div ref={mobileMenuRef} className="relative">
                <button
                  onClick={() => setMobileMenuOpen(v => !v)}
                  aria-label={labels.more}
                  aria-haspopup="menu"
                  aria-expanded={mobileMenuOpen}
                  className="text-stone-600 p-2.5 rounded-xl hover:bg-stone-100 border border-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  <MoreVertical size={18} />
                </button>
                {mobileMenuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-52 rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden z-50">
                    <button
                      role="menuitem"
                      onClick={() => { setMobileMenuOpen(false); onShare(); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-stone-700 hover:bg-stone-50 focus:outline-none focus-visible:bg-stone-100"
                    >
                      <Share2 size={16} className="text-stone-500" />
                      {labels.shareResults}
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setMobileMenuOpen(false); onOpenSettings(); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-stone-700 hover:bg-stone-50 focus:outline-none focus-visible:bg-stone-100"
                    >
                      <Settings size={16} className="text-stone-500" />
                      {labels.settings}
                    </button>
                    <div className="h-px bg-stone-100" />
                    <button
                      role="menuitem"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-stone-700 hover:bg-stone-50 focus:outline-none focus-visible:bg-stone-100"
                    >
                      <LogOut size={16} className="text-stone-500" />
                      {labels.signOut}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
