// 懒加载组件
import { lazy, Suspense } from 'react';
import LoadingSpinner from './ui/LoadingSpinner';

// 懒加载图表组件
export const LazyDomainPerformanceChart = lazy(() => 
  import('./charts/DomainPerformanceChart')
);

// 懒加载市场组件
export const LazyDomainMarketplace = lazy(() => 
  import('./marketplace/DomainMarketplace')
);

// 懒加载数据管理组件
export const LazyDataImportExport = lazy(() => 
  import('./data/DataImportExport')
);

// 懒加载设置组件
export const LazyUserPreferencesPanel = lazy(() => 
  import('./settings/UserPreferencesPanel')
);

// 懒加载通知组件
export const LazyAdvancedNotificationSystem = lazy(() => 
  import('./notifications/AdvancedNotificationSystem')
);


// 懒加载到期提醒
export const LazyDomainExpiryAlert = lazy(() => 
  import('./alerts/DomainExpiryAlert')
);

// 懒加载包装器
interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function LazyWrapper({ children, fallback }: LazyWrapperProps) {
  return (
    <Suspense fallback={fallback || <LoadingSpinner text="加载中..." />}>
      {children}
    </Suspense>
  );
}

// 预加载组件
export const preloadComponents = () => {
  // 预加载关键组件
  import('./charts/DomainPerformanceChart');
  import('./marketplace/DomainMarketplace');
  import('./data/DataImportExport');
};

// 路由级别的代码分割
export const LazyDashboard = lazy(() => import('../../app/dashboard/page'));
export const LazyLogin = lazy(() => import('../../app/login/page'));
