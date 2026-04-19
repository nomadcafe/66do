'use client';

import { TrendingUp, TrendingDown, Globe, Award, Calendar } from 'lucide-react';

interface PortfolioHealthCardProps {
  totalDomains: number;
  activeDomains: number;
  soldDomains: number;
  totalRevenue: number;
  totalProfit: number;
  roi: number;
  /** Monthly revenue points, oldest → newest. Length is parent's choice and reflects the active window. */
  monthlyRevenueSeries: number[];
  /** Days until the next domain expiry; null if none upcoming */
  nextExpiryDays: number | null;
  formatCurrency: (n: number, c?: 'USD') => string;
  /** Optional trend-window selector. Affects sparkline only; other stats stay all-time. */
  windowOptions?: { key: string; label: string }[];
  selectedWindow?: string;
  onWindowChange?: (key: string) => void;
  labels: {
    portfolioRevenue: string;
    /** Caption under the sparkline (e.g. "Last 12 months", "All time") */
    windowCaption: string;
    totalProfit: string;
    domains: string;
    activeSold: (active: number, sold: number) => string;
    roi: string;
    nextExpiry: string;
    days: string;
    none: string;
    expired: string;
    trendWindowAria: string;
  };
}

/**
 * Hero "portfolio health" card — replaces the four-tile KPI row.
 * One number + sparkline + compact stats. Communicates change, not just totals.
 */
export default function PortfolioHealthCard({
  totalDomains,
  activeDomains,
  soldDomains,
  totalRevenue,
  totalProfit,
  roi,
  monthlyRevenueSeries,
  nextExpiryDays,
  formatCurrency,
  windowOptions,
  selectedWindow,
  onWindowChange,
  labels,
}: PortfolioHealthCardProps) {
  // Normalize: ensure at least 2 points so the sparkline path math is sane.
  const series = monthlyRevenueSeries.length >= 2
    ? monthlyRevenueSeries
    : monthlyRevenueSeries.length === 1
      ? [0, monthlyRevenueSeries[0]]
      : [0, 0];

  // Month-over-month delta (last vs prev), guards divide-by-zero
  const lastMonth = series[series.length - 1] ?? 0;
  const prevMonth = series[series.length - 2] ?? 0;
  const monthlyDeltaPct = prevMonth > 0
    ? ((lastMonth - prevMonth) / prevMonth) * 100
    : null;

  // SVG sparkline (200×60 viewBox, padded 4)
  const minV = Math.min(...series, 0);
  const maxV = Math.max(...series, 1);
  const range = Math.max(maxV - minV, 1);
  const sparkPath = series
    .map((v, i) => {
      const x = 4 + (i / (series.length - 1)) * 192;
      const y = 52 - ((v - minV) / range) * 48;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const sparkArea = `${sparkPath} L196,56 L4,56 Z`;

  const isProfitPositive = totalProfit >= 0;
  const trendUp = monthlyDeltaPct !== null && monthlyDeltaPct >= 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
      <div className="absolute -top-12 -right-12 -z-0 h-48 w-48 rounded-full bg-gradient-to-br from-teal-100/60 via-emerald-100/30 to-transparent blur-3xl" />

      <div className="relative">
        {/* Top: label + delta */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            {labels.portfolioRevenue}
          </p>
          {monthlyDeltaPct !== null && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trendUp ? '+' : ''}{monthlyDeltaPct.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Big number */}
        <p className="mt-2 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
          {formatCurrency(totalRevenue)}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {labels.totalProfit}{' '}
          <span className={isProfitPositive ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
            {isProfitPositive ? '+' : ''}{formatCurrency(totalProfit)}
          </span>
        </p>

        {/* Sparkline + optional window selector */}
        <div className="mt-5 flex items-end justify-between gap-3">
          <svg viewBox="0 0 200 60" className="h-16 flex-1" preserveAspectRatio="none" role="img" aria-label={labels.windowCaption}>
            <defs>
              <linearGradient id="phc-spark-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={sparkArea} fill="url(#phc-spark-grad)" />
            <path d={sparkPath} fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {windowOptions && windowOptions.length > 0 && onWindowChange && (
            <div role="group" aria-label={labels.trendWindowAria} className="flex shrink-0 items-center gap-0.5 p-0.5 rounded-lg border border-stone-200 bg-stone-50">
              {windowOptions.map((opt) => {
                const active = opt.key === selectedWindow;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onWindowChange(opt.key)}
                    aria-pressed={active}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                      active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <p className="mt-1 text-[11px] text-stone-400">{labels.windowCaption}</p>

        {/* Compact stats footer */}
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-stone-100 pt-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
              <Globe className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{labels.domains}</p>
              <p className="truncate text-sm font-semibold text-stone-900">
                {totalDomains}
                <span className="ml-1 text-xs font-normal text-stone-500">
                  {labels.activeSold(activeDomains, soldDomains)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Award className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{labels.roi}</p>
              <p className={`text-sm font-semibold ${roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              nextExpiryDays !== null && nextExpiryDays <= 7
                ? 'bg-rose-50 text-rose-600'
                : 'bg-stone-100 text-stone-600'
            }`}>
              <Calendar className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{labels.nextExpiry}</p>
              <p className="text-sm font-semibold text-stone-900">
                {nextExpiryDays === null
                  ? labels.none
                  : nextExpiryDays < 0
                    ? labels.expired
                    : `${nextExpiryDays}${labels.days}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
