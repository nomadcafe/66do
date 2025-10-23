'use client';

import { ReactNode } from 'react';

interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
}

export default function ResponsiveGrid({ 
  children, 
  className = '', 
  cols = { default: 1, sm: 2, md: 3, lg: 4 },
  gap = 'md'
}: ResponsiveGridProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  };

  const getGridCols = () => {
    const baseCols = cols.default || 1;
    const smCols = cols.sm || baseCols;
    const mdCols = cols.md || smCols;
    const lgCols = cols.lg || mdCols;
    const xlCols = cols.xl || lgCols;

    return `grid-cols-${baseCols} sm:grid-cols-${smCols} md:grid-cols-${mdCols} lg:grid-cols-${lgCols} xl:grid-cols-${xlCols}`;
  };

  return (
    <div className={`grid ${getGridCols()} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
}
