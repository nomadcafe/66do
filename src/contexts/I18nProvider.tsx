'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useI18n } from '../hooks/useI18n';

interface I18nContextType {
  locale: 'zh' | 'en';
  setLocale: (locale: 'zh' | 'en') => void;
  t: (key: string) => string;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const i18n = useI18n();

  return (
    <I18nContext.Provider value={i18n}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18nContext() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18nContext must be used within an I18nProvider');
  }
  return context;
}
