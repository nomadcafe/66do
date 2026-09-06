'use client';

import React, { lazy, Suspense } from 'react';

// 懒加载组件
export const LazyFinancialAnalysis = lazy(() => import('./reports/FinancialAnalysisOptimized'));
export const LazyInvestmentAnalytics = lazy(() => import('./analytics/InvestmentAnalytics'));
export const LazyUpcomingRenewals = lazy(() => import('./analytics/UpcomingRenewals'));
export const LazyAdvancedRenewalAnalysis = lazy(() => import('./analytics/AdvancedRenewalAnalysis'));
export const LazyExpiredDomainLossAnalysis = lazy(() => import('./analytics/ExpiredDomainLossAnalysis'));
export const LazyYearlyCashflowTable = lazy(() => import('./analytics/YearlyCashflowTable'));
export const LazyDataImportExport = lazy(() => import('./data/DataImportExport'));
export const LazyUserPreferencesPanel = lazy(() => import('./settings/UserPreferencesPanel'));

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

// 预加载函数
export const preloadComponents = () => {
  // 预加载关键组件
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