'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Globe, Award, Calendar } from 'lucide-react';

interface PortfolioHealthCardProps {
  totalDomains: number;
  activeDomains: number;
  soldDomains: number;
  /** The headline number — sum for the active window (or all-time if window = All). */
  displayRevenue: number;
  /** All-time total, shown as secondary when different from displayRevenue. */
  allTimeRevenue: number;
  roi: number;
  /** Monthly revenue points, oldest → newest. Length is parent's choice and reflects the active window. */
  monthlyRevenueSeries: number[];
  /** Optional month labels (same length as series) for hover tooltip + axis context. */
  monthlyRevenueLabels?: string[];
  /** Days until the next domain expiry; null if none upcoming */
  nextExpiryDays: number | null;
  /** Domain name of the soonest-expiring domain, for context. */
  nextExpiryDomain?: string | null;
  /** Pre-formatted date label (e.g. "Apr 25") for the soonest expiry. */
  nextExpiryDateLabel?: string | null;
  formatCurrency: (n: number, c?: 'USD') => string;
  /** Optional trend-window selector. Affects sparkline + headline only; footer stats stay all-time. */
  windowOptions?: { key: string; label: string }[];
  selectedWindow?: string;
  onWindowChange?: (key: string) => void;
  labels: {
    portfolioRevenue: string;
    /** Short label of the active window (e.g. "Last 3 months", "All time") */
    windowCaption: string;
    /** Prefix for the all-time anchor (e.g. "all-time"); only shown when window != All */
    allTimeAnchor: string;
    domains: string;
    activeSold: (active: number, sold: number) => string;
    roi: string;
    nextExpiry: string;
    days: string;
    none: string;
    expired: string;
    trendWindowAria: string;
    /** Caption above the footer stat row clarifying that those numbers are all-time, regardless of the windowed headline. */
    allTimeFooter?: string;
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
  displayRevenue,
  allTimeRevenue,
  roi,
  monthlyRevenueSeries,
  monthlyRevenueLabels,
  nextExpiryDays,
  nextExpiryDomain,
  nextExpiryDateLabel,
  formatCurrency,
  windowOptions,
  selectedWindow,
  onWindowChange,
  labels,
}: PortfolioHealthCardProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // 区分单点 vs 多点。原实现把单点拓成 [0, value] 画线，会让用户看到一条
  // 从 0 飙到 value 的"假 spike"，但实际上只是没有更早的数据。单点应该
  // 只渲染一个圆点，不画线 / 面积。
  const isSinglePoint = monthlyRevenueSeries.length === 1;
  const series = monthlyRevenueSeries.length >= 1 ? monthlyRevenueSeries : [0];

  // delta 徽章的 4 种状态：
  //   - 都是 0：不显示
  //   - 上月 0、本月 > 0：首次进账，只显示上箭头（无 %，避免 ÷0）
  //   - 上月 > 0、本月 0：清零，只显示下箭头（不是 -100% 的硬数值，更克制）
  //   - 都 > 0：百分比，绝对值 > 999 时夹到上限，避免出现 +99900% 这种小基数失真
  const lastMonth = series[series.length - 1] ?? 0;
  const prevMonth = series.length >= 2 ? (series[series.length - 2] ?? 0) : 0;
  type DeltaBadge = { trendUp: boolean; text: string | null };
  let deltaBadge: DeltaBadge | null = null;
  if (lastMonth > 0 && prevMonth === 0) {
    deltaBadge = { trendUp: true, text: null };
  } else if (lastMonth === 0 && prevMonth > 0) {
    deltaBadge = { trendUp: false, text: null };
  } else if (prevMonth > 0) {
    const pct = ((lastMonth - prevMonth) / prevMonth) * 100;
    const capped = Math.abs(pct) > 999;
    deltaBadge = {
      trendUp: pct >= 0,
      text: capped
        ? (pct > 0 ? '>+999%' : '<-99%')
        : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
    };
  }

  // SVG sparkline (200×60 viewBox)
  // y 公式：v = 0 → y = 56（chart 底部），v = max → y = 4（chart 顶部）。
  // 旧公式 y = 52 - (v/range)*48 在 v = 0 时 y = 52，离底部还有 4 单位 padding，
  // area 在 0 月份处仍会画出一条 4 单位的薄带，看起来像"该月还有营收"。
  // 新公式让 0 值的 area 高度恰好为 0，不再误导。
  const sparkBase = isSinglePoint ? [0, ...series] : series;
  const minV = Math.min(...sparkBase, 0);
  const maxV = Math.max(...sparkBase, 1);
  const range = Math.max(maxV - minV, 1);
  const pointXY = (i: number, v: number) => {
    const denom = Math.max(series.length - 1, 1);
    const x = isSinglePoint ? 100 : 4 + (i / denom) * 192;
    const y = 56 - ((v - minV) / range) * 52;
    return { x, y };
  };
  const sparkPath = isSinglePoint
    ? ''
    : series
        .map((v, i) => {
          const { x, y } = pointXY(i, v);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
  const sparkArea = isSinglePoint ? '' : `${sparkPath} L196,56 L4,56 Z`;

  // 轴标签：取首 / 末两个月，序列长度 ≥ 6 时再补一个中点；少于 2 个月时不显示
  const axisTicks: { idx: number; label: string }[] = [];
  if (monthlyRevenueLabels && monthlyRevenueLabels.length >= 2) {
    axisTicks.push({ idx: 0, label: monthlyRevenueLabels[0] });
    if (monthlyRevenueLabels.length >= 6) {
      const mid = Math.floor((monthlyRevenueLabels.length - 1) / 2);
      axisTicks.push({ idx: mid, label: monthlyRevenueLabels[mid] });
    }
    axisTicks.push({
      idx: monthlyRevenueLabels.length - 1,
      label: monthlyRevenueLabels[monthlyRevenueLabels.length - 1],
    });
  }

  const showAllTimeAnchor = displayRevenue !== allTimeRevenue;
  const hoveredLabel = hoverIdx !== null && monthlyRevenueLabels?.[hoverIdx];
  const hoveredValue = hoverIdx !== null ? series[hoverIdx] : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
      <div className="absolute -top-12 -right-12 -z-0 h-48 w-48 rounded-full bg-gradient-to-br from-teal-100/60 via-emerald-100/30 to-transparent blur-3xl" />

      <div className="relative">
        {/* Top: label + delta */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            {labels.portfolioRevenue}
          </p>
          {deltaBadge && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              deltaBadge.trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {deltaBadge.trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {deltaBadge.text}
            </span>
          )}
        </div>

        {/* Big number — reflects the active window */}
        <p className="mt-2 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
          {formatCurrency(displayRevenue)}
        </p>
        {/* h-5 锁高度避免 hover 切换时下方布局抖动 */}
        <p className="mt-1 text-sm text-stone-500 h-5">
          {hoveredLabel && hoveredValue !== null ? (
            <>
              <span className="font-medium text-stone-700">{hoveredLabel}</span>
              {' · '}
              <span className="font-semibold text-teal-700 tabular-nums">{formatCurrency(hoveredValue)}</span>
            </>
          ) : (
            <>
              <span className="font-medium text-stone-600">{labels.windowCaption}</span>
              {showAllTimeAnchor && (
                <>
                  {' · '}
                  <span>{labels.allTimeAnchor} {formatCurrency(allTimeRevenue)}</span>
                </>
              )}
            </>
          )}
        </p>

        {/* Sparkline + optional window selector */}
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
          <svg
            viewBox="0 0 200 60"
            className="h-16 w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label={labels.windowCaption}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="phc-spark-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
              </linearGradient>
            </defs>
            {!isSinglePoint && (
              <>
                <path d={sparkArea} fill="url(#phc-spark-grad)" />
                <path d={sparkPath} fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
            {/* 单点：放在画布中心一个圆点（不参与缩放，避免 y 算到顶），
                避免拼一个 [0, value] 让用户看到从 0 飙升的假象 */}
            {isSinglePoint && (
              <circle cx={100} cy={30} r={4} fill="#0d9488" />
            )}
            {/* hover 指示线 + 实心圆点 */}
            {hoverIdx !== null && (() => {
              const { x, y } = pointXY(hoverIdx, series[hoverIdx]);
              return (
                <g pointerEvents="none">
                  <line x1={x} y1={4} x2={x} y2={56} stroke="#a8a29e" strokeDasharray="2 2" strokeWidth={1} />
                  <circle cx={x} cy={y} r={3.5} fill="#0d9488" stroke="#fff" strokeWidth={1.5} />
                </g>
              );
            })()}
            {/* 隐形 hit area：每个点占 1/n 宽度，覆盖整列方便鼠标对位 */}
            {series.length > 1 && series.map((_, i) => {
              const denom = Math.max(series.length - 1, 1);
              const cx = 4 + (i / denom) * 192;
              const half = 192 / Math.max(series.length, 1) / 2;
              return (
                <rect
                  key={i}
                  x={Math.max(0, cx - half)}
                  y={0}
                  width={Math.min(200, half * 2)}
                  height={60}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  style={{ cursor: 'crosshair' }}
                />
              );
            })}
          </svg>
          {/* x 轴月份 ticks：触摸用户/不 hover 用户也能看到时间起止上下文。
              首/末 + 序列 ≥ 6 时再补一个中点。绝对定位避免被 sparkline 撑变形 */}
          {axisTicks.length >= 2 && (
            <div className="relative mt-1.5 h-3 text-[10px] text-stone-400 tabular-nums">
              {axisTicks.map((t, i) => {
                const isFirst = i === 0;
                const isLast = i === axisTicks.length - 1;
                const style: React.CSSProperties = isFirst
                  ? { left: 0 }
                  : isLast
                    ? { right: 0 }
                    : { left: '50%', transform: 'translateX(-50%)' };
                return (
                  <span key={t.idx} className="absolute top-0" style={style}>
                    {t.label}
                  </span>
                );
              })}
            </div>
          )}
          </div>
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

        {/* Compact stats footer (all-time)
            顶部 headline 跟随窗口（3M/6M/1Y/All）变，footer 三项统计始终是
            all-time（窗口化对域名计数 / ROI / 下次到期没有意义）。加一个小标
            注让混合时间口径显式可见，避免用户误以为这些也跟着窗口变。 */}
        {labels.allTimeFooter && (
          <p className="mt-5 -mb-3 text-[10px] font-medium uppercase tracking-wider text-stone-400">
            {labels.allTimeFooter}
          </p>
        )}
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
              {nextExpiryDays === null ? (
                <p className="text-sm font-semibold text-stone-500">{labels.none}</p>
              ) : (
                <>
                  {/* 优先显示域名 + 日期/天数；旧实现只有"30d"，用户得另外去
                      Domain 列表查是哪个域名要到期 */}
                  {nextExpiryDomain && (
                    <p className="text-sm font-semibold text-stone-900 truncate" title={nextExpiryDomain}>
                      {nextExpiryDomain}
                    </p>
                  )}
                  <p className={`text-xs ${nextExpiryDays < 0 ? 'text-rose-600 font-semibold' : nextExpiryDays <= 7 ? 'text-rose-600' : 'text-stone-500'} tabular-nums`}>
                    {nextExpiryDays < 0 ? labels.expired : `${nextExpiryDays}${labels.days}`}
                    {nextExpiryDateLabel && nextExpiryDays >= 0 && (
                      <span className="ml-1 text-stone-400">· {nextExpiryDateLabel}</span>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
