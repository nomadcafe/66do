'use client';

import React, { useMemo } from 'react';
import { useI18nContext } from '../../contexts/I18nProvider';

// 图表类型定义
export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
  }[];
}

export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: {
    legend?: {
      display?: boolean;
      position?: 'top' | 'bottom' | 'left' | 'right';
    };
    title?: {
      display?: boolean;
      text?: string;
    };
    tooltip?: {
      enabled?: boolean;
    };
  };
  scales?: {
    x?: {
      display?: boolean;
      title?: {
        display?: boolean;
        text?: string;
      };
    };
    y?: {
      display?: boolean;
      title?: {
        display?: boolean;
        text?: string;
      };
      beginAtZero?: boolean;
    };
  };
}

// 颜色主题
export const CHART_COLORS = {
  primary: '#3B82F6',
  secondary: '#10B981',
  accent: '#F59E0B',
  danger: '#EF4444',
  warning: '#F97316',
  info: '#06B6D4',
  success: '#22C55E',
  purple: '#8B5CF6',
  pink: '#EC4899',
  indigo: '#6366F1',
  teal: '#14B8A6',
  orange: '#F97316',
  gray: '#6B7280',
  gradients: {
    blue: ['#3B82F6', '#1D4ED8', '#1E40AF'],
    green: ['#10B981', '#059669', '#047857'],
    purple: ['#8B5CF6', '#7C3AED', '#6D28D9'],
    orange: ['#F59E0B', '#D97706', '#B45309'],
    red: ['#EF4444', '#DC2626', '#B91C1C'],
  }
};

// 基础图表组件
interface BaseChartProps {
  data: ChartData;
  options?: ChartOptions;
  className?: string;
  height?: number;
}

export function BaseChart({ className = '', height = 300 }: BaseChartProps) {
  const { t } = useI18nContext();

  return (
    <div className={`relative ${className}`} style={{ height: `${height}px` }}>
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-gray-600">{t('charts.placeholder')}</p>
          <p className="text-sm text-gray-500 mt-1">{t('charts.installChartLibrary')}</p>
        </div>
      </div>
    </div>
  );
}

// 投资趋势图表
interface InvestmentTrendChartProps {
  data: {
    date: string;
    investment: number;
    revenue: number;
    profit: number;
  }[];
  className?: string;
}

export function InvestmentTrendChart({ data, className = '' }: InvestmentTrendChartProps) {
  const { t } = useI18nContext();
  
  const chartData: ChartData = useMemo(() => {
    const labels = data.map(item => new Date(item.date).toLocaleDateString());
    
    return {
      labels,
      datasets: [
        {
          label: t('charts.investment'),
          data: data.map(item => item.investment),
          backgroundColor: CHART_COLORS.gradients.blue[0],
          borderColor: CHART_COLORS.gradients.blue[1],
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
        {
          label: t('charts.revenue'),
          data: data.map(item => item.revenue),
          backgroundColor: CHART_COLORS.gradients.green[0],
          borderColor: CHART_COLORS.gradients.green[1],
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
        {
          label: t('charts.profit'),
          data: data.map(item => item.profit),
          backgroundColor: CHART_COLORS.gradients.purple[0],
          borderColor: CHART_COLORS.gradients.purple[1],
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
      ],
    };
  }, [data, t]);

  const options: ChartOptions = {
    plugins: {
      title: {
        display: true,
        text: t('charts.investmentTrend'),
      },
      legend: {
        display: true,
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: t('charts.amount'),
        },
      },
      x: {
        title: {
          display: true,
          text: t('charts.date'),
        },
      },
    },
  };

  return (
    <BaseChart
      data={chartData}
      options={options}
      className={className}
      height={400}
    />
  );
}

// 域名状态分布饼图
interface DomainStatusChartProps {
  data: {
    active: number;
    forSale: number;
    sold: number;
    expired: number;
  };
  className?: string;
}

export function DomainStatusChart({ data, className = '' }: DomainStatusChartProps) {
  const { t } = useI18nContext();
  
  const chartData: ChartData = useMemo(() => {
    return {
      labels: [
        t('charts.activeDomains'),
        t('charts.forSaleDomains'),
        t('charts.soldDomains'),
        t('charts.expiredDomains'),
      ],
      datasets: [
        {
          label: t('charts.domainCount'),
          data: [data.active, data.forSale, data.sold, data.expired],
          backgroundColor: [
            CHART_COLORS.success,
            CHART_COLORS.warning,
            CHART_COLORS.primary,
            CHART_COLORS.danger,
          ],
          borderColor: [
            CHART_COLORS.success,
            CHART_COLORS.warning,
            CHART_COLORS.primary,
            CHART_COLORS.danger,
          ],
          borderWidth: 2,
        },
      ],
    };
  }, [data, t]);

  const options: ChartOptions = {
    plugins: {
      title: {
        display: true,
        text: t('charts.domainStatusDistribution'),
      },
      legend: {
        display: true,
        position: 'right',
      },
    },
  };

  return (
    <BaseChart
      data={chartData}
      options={options}
      className={className}
      height={300}
    />
  );
}

// ROI对比柱状图
interface ROIComparisonChartProps {
  data: {
    domain: string;
    roi: number;
    investment: number;
    revenue: number;
  }[];
  className?: string;
}

export function ROIComparisonChart({ data, className = '' }: ROIComparisonChartProps) {
  const { t } = useI18nContext();
  
  const chartData: ChartData = useMemo(() => {
    const sortedData = [...data].sort((a, b) => b.roi - a.roi).slice(0, 10);
    
    return {
      labels: sortedData.map(item => item.domain),
      datasets: [
        {
          label: t('charts.roi'),
          data: sortedData.map(item => item.roi),
          backgroundColor: sortedData.map((_, index) => 
            index < 3 ? CHART_COLORS.success : 
            index < 7 ? CHART_COLORS.warning : 
            CHART_COLORS.danger
          ),
          borderColor: sortedData.map((_, index) => 
            index < 3 ? CHART_COLORS.success : 
            index < 7 ? CHART_COLORS.warning : 
            CHART_COLORS.danger
          ),
          borderWidth: 1,
        },
      ],
    };
  }, [data, t]);

  const options: ChartOptions = {
    plugins: {
      title: {
        display: true,
        text: t('charts.topROIDomains'),
      },
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: t('charts.roiPercentage'),
        },
      },
      x: {
        title: {
          display: true,
          text: t('charts.domainName'),
        },
      },
    },
  };

  return (
    <BaseChart
      data={chartData}
      options={options}
      className={className}
      height={400}
    />
  );
}

// 月度收入趋势图
interface MonthlyRevenueChartProps {
  data: {
    month: string;
    revenue: number;
    investment: number;
    profit: number;
  }[];
  className?: string;
}

export function MonthlyRevenueChart({ data, className = '' }: MonthlyRevenueChartProps) {
  const { t } = useI18nContext();
  
  const chartData: ChartData = useMemo(() => {
    return {
      labels: data.map(item => item.month),
      datasets: [
        {
          label: t('charts.revenue'),
          data: data.map(item => item.revenue),
          backgroundColor: CHART_COLORS.gradients.green[0],
          borderColor: CHART_COLORS.gradients.green[1],
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
        {
          label: t('charts.investment'),
          data: data.map(item => item.investment),
          backgroundColor: CHART_COLORS.gradients.blue[0],
          borderColor: CHART_COLORS.gradients.blue[1],
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [data, t]);

  const options: ChartOptions = {
    plugins: {
      title: {
        display: true,
        text: t('charts.monthlyRevenueTrend'),
      },
      legend: {
        display: true,
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: t('charts.amount'),
        },
      },
      x: {
        title: {
          display: true,
          text: t('charts.month'),
        },
      },
    },
  };

  return (
    <BaseChart
      data={chartData}
      options={options}
      className={className}
      height={350}
    />
  );
}

// 平台费用分析图
interface PlatformFeeChartProps {
  data: {
    platform: string;
    totalFees: number;
    transactionCount: number;
    averageFee: number;
  }[];
  className?: string;
}

export function PlatformFeeChart({ data, className = '' }: PlatformFeeChartProps) {
  const { t } = useI18nContext();
  
  const chartData: ChartData = useMemo(() => {
    return {
      labels: data.map(item => item.platform),
      datasets: [
        {
          label: t('charts.totalFees'),
          data: data.map(item => item.totalFees),
          backgroundColor: CHART_COLORS.gradients.purple[0],
          borderColor: CHART_COLORS.gradients.purple[1],
          borderWidth: 2,
        },
        {
          label: t('charts.averageFee'),
          data: data.map(item => item.averageFee),
          backgroundColor: CHART_COLORS.gradients.orange[0],
          borderColor: CHART_COLORS.gradients.orange[1],
          borderWidth: 2,
        },
      ],
    };
  }, [data, t]);

  const options: ChartOptions = {
    plugins: {
      title: {
        display: true,
        text: t('charts.platformFeeAnalysis'),
      },
      legend: {
        display: true,
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: t('charts.amount'),
        },
      },
      x: {
        title: {
          display: true,
          text: t('charts.platform'),
        },
      },
    },
  };

  return (
    <BaseChart
      data={chartData}
      options={options}
      className={className}
      height={350}
    />
  );
}

// 投资组合价值变化图
interface PortfolioValueChartProps {
  data: {
    date: string;
    totalValue: number;
    totalInvestment: number;
    totalRevenue: number;
  }[];
  className?: string;
}

export function PortfolioValueChart({ data, className = '' }: PortfolioValueChartProps) {
  const { t } = useI18nContext();
  
  const chartData: ChartData = useMemo(() => {
    return {
      labels: data.map(item => new Date(item.date).toLocaleDateString()),
      datasets: [
        {
          label: t('charts.totalValue'),
          data: data.map(item => item.totalValue),
          backgroundColor: CHART_COLORS.gradients.blue[0],
          borderColor: CHART_COLORS.gradients.blue[1],
          borderWidth: 3,
          fill: true,
          tension: 0.4,
        },
        {
          label: t('charts.totalInvestment'),
          data: data.map(item => item.totalInvestment),
          backgroundColor: CHART_COLORS.gradients.green[0],
          borderColor: CHART_COLORS.gradients.green[1],
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
        {
          label: t('charts.totalRevenue'),
          data: data.map(item => item.totalRevenue),
          backgroundColor: CHART_COLORS.gradients.purple[0],
          borderColor: CHART_COLORS.gradients.purple[1],
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
      ],
    };
  }, [data, t]);

  const options: ChartOptions = {
    plugins: {
      title: {
        display: true,
        text: t('charts.portfolioValueChange'),
      },
      legend: {
        display: true,
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: t('charts.value'),
        },
      },
      x: {
        title: {
          display: true,
          text: t('charts.date'),
        },
      },
    },
  };

  return (
    <BaseChart
      data={chartData}
      options={options}
      className={className}
      height={400}
    />
  );
}
