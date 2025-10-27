'use client';

import React, { lazy, Suspense } from 'react';
import { useI18nContext } from '../contexts/I18nProvider';

// 懒加载组件
export const LazyFinancialReport = lazy(() => import('./reports/FinancialReport'));
export const LazyFinancialAnalysis = lazy(() => import('./reports/FinancialAnalysisOptimized'));
export const LazyInvestmentAnalytics = lazy(() => import('./analytics/InvestmentAnalytics'));
export const LazyAdvancedRenewalAnalysis = lazy(() => import('./analytics/AdvancedRenewalAnalysis'));
export const LazyExpiredDomainLossAnalysis = lazy(() => import('./analytics/ExpiredDomainLossAnalysis'));
export const LazyHistoricalRatesReport = lazy(() => import('./reports/HistoricalRatesReport'));
export const LazyDataImportExport = lazy(() => import('./data/DataImportExport'));
export const LazyUserPreferencesPanel = lazy(() => import('./settings/UserPreferencesPanel'));
export const LazyDomainExpiryAlert = lazy(() => import('./alerts/DomainExpiryAlert'));
export const LazyAutoDomainMonitor = lazy(() => import('./monitoring/AutoDomainMonitor'));

// 加载中组件
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

// 懒加载包装器
export const LazyWrapper = ({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) => (
  <Suspense fallback={fallback || <LoadingSpinner />}>
    {children}
  </Suspense>
);

// 带错误边界的懒加载包装器
export const LazyWrapperWithErrorBoundary = ({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) => {
  return (
    <Suspense fallback={fallback || <LoadingSpinner />}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </Suspense>
  );
};

// 简单的错误边界组件
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">
            组件加载失败，请刷新页面重试
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

// 预加载函数
export const preloadComponents = () => {
  // 预加载关键组件
  import('./reports/FinancialReport');
  import('./reports/FinancialAnalysisOptimized');
  import('./analytics/InvestmentAnalytics');
};

// 智能预加载：在用户空闲时预加载
export const useSmartPreload = () => {
  React.useEffect(() => {
    const preload = () => {
      preloadComponents();
    };

    // 在用户空闲时预加载
    if ('requestIdleCallback' in window) {
      requestIdleCallback(preload);
    } else {
      // 降级到setTimeout
      setTimeout(preload, 2000);
    }
  }, []);
};