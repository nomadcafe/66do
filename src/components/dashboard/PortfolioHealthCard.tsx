'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Globe, Award, RefreshCw } from 'lucide-react';

interface PortfolioHealthCardProps {
  totalDomains: number;
  activeDomains: number;
  soldDomains: number;
  /** All-time cumulative Realized P&L (sellNet − cost basis at sale, summed). */
  realizedPnLAllTime: number;
  /** Realized P&L within the active trend window — used for the period delta caption. */
  realizedPnLInWindow: number;
  /** Per-month realized P&L for the sparkline (oldest → newest). */
  realizedPnLSeries: number[];
  /** Optional month labels (same length as series) for hover tooltip. */
  realizedPnLLabels?: string[];
  /** Number of completed sales feeding into Realized P&L. */
  completedSalesCount: number;
  /** Sum of holdingCostAsOf for active + for_sale domains (current "inventory at cost"). */
  portfolioAtCost: number;
  roi: number;
  /** Status composition counts for the mini donut. */
  composition: { active: number; forSale: number; sold: number; expired: number };
  /** Amortized YTD renewal cost — the steady-state operational annual cost. */
  ytdRenewalSpendAmortized: number;
  /** Cash YTD renewal — what actually left the bank this calendar year. */
  ytdRenewalSpendCash: number;
  currentYear: number;
  formatCurrency: (n: number) => string;
  windowOptions?: { key: string; label: string }[];
  selectedWindow?: string;
  onWindowChange?: (key: string) => void;
  labels: {
    realizedPnL: string;
    portfolioAtCost: string;
    /** "{n} sales" / "{n} 笔出售". Component substitutes {n}. */
    fromSales: string;
    fromOneSale: string;
    noSales: string;
    /** "{active} held · {forSale} listed". Component substitutes both. */
    heldListed: (active: number, forSale: number) => string;
    /** "{sold} sold · {expired} lost". Component substitutes both. */
    lifecycle: (sold: number, expired: number) => string;
    /** "All-time {amount}". Component substitutes {amount}. */
    allTime: (amount: string) => string;
    /** "{sign}{amount} this period". Component substitutes both. */
    windowDelta: (signedAmount: string) => string;
    windowCaption: string;
    domains: string;
    activeSold: (active: number, sold: number) => string;
    roi: string;
    ytdRenewalSpend: string;
    ytdRenewalCashPaid: string;
    trendWindowAria: string;
    /** Caption above the footer stat row. */
    allTimeFooter: string;
  };
}

/**
 * Hero "portfolio command center" — replaces the single-revenue card with a
 * dual-metric layout that answers two questions simultaneously:
 *
 *   1. "How am I doing?"  → Realized P&L (gains/losses from completed trades)
 *   2. "How big is my operation?" → Portfolio at Cost (held domains, at cost basis)
 *
 * Design rationale:
 * - Two big numbers, not one. A buy-and-hold investor with $0 realized P&L
 *   still has a meaningful "Portfolio at Cost" growing over time, so the card
 *   never reads as "you've done nothing".
 * - Realized P&L colored by sign (emerald / rose) so the performance is
 *   readable at a glance.
 * - Right-side composition donut surfaces inventory shape (active / for_sale /
 *   sold / expired) — previously this only showed up deep inside InvestmentAnalytics.
 * - Light gradient background + saturated number colors deliberately move
 *   away from the previous all-stone palette without going dark/heavy.
 */
export default function PortfolioHealthCard({
  totalDomains,
  realizedPnLAllTime,
  realizedPnLInWindow,
  realizedPnLSeries,
  realizedPnLLabels,
  completedSalesCount,
  portfolioAtCost,
  roi,
  composition,
  ytdRenewalSpendAmortized,
  ytdRenewalSpendCash,
  currentYear,
  formatCurrency,
  windowOptions,
  selectedWindow,
  onWindowChange,
  labels,
}: PortfolioHealthCardProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // ── Realized P&L hero number color ─────────────────────────────────────
  const pnlPositive = realizedPnLAllTime > 0;
  const pnlNegative = realizedPnLAllTime < 0;
  const pnlColorClass = pnlPositive
    ? 'text-emerald-600'
    : pnlNegative
      ? 'text-rose-600'
      : 'text-stone-900';
  const pnlSign = pnlPositive ? '+' : pnlNegative ? '−' : '';
  const pnlAbsFormatted = formatCurrency(Math.abs(realizedPnLAllTime));

  // ── Window delta badge (period contribution to Realized P&L) ───────────
  const windowDeltaSign = realizedPnLInWindow > 0 ? '+' : realizedPnLInWindow < 0 ? '−' : '';
  const windowDeltaAbs = formatCurrency(Math.abs(realizedPnLInWindow));
  const windowDeltaCaption = labels.windowDelta(`${windowDeltaSign}${windowDeltaAbs}`);

  // ── Sparkline geometry (200×60 viewBox) ────────────────────────────────
  const series = realizedPnLSeries.length > 0 ? realizedPnLSeries : [0];
  const isSinglePoint = series.length === 1;
  const minV = Math.min(...series, 0);
  const maxV = Math.max(...series, 0);
  const range = Math.max(maxV - minV, 1);
  const zeroY = 56 - ((0 - minV) / range) * 52;
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

  // 区分正/负盈亏的填充：正为 emerald 渐变，负为 rose 渐变。
  // 简化处理：单色填充按累计 P&L 走向决定。
  const sparkAccent = pnlPositive ? '#10b981' : pnlNegative ? '#f43f5e' : '#0d9488';

  // 轴标签
  const axisTicks: { idx: number; label: string }[] = [];
  if (realizedPnLLabels && realizedPnLLabels.length >= 2) {
    axisTicks.push({ idx: 0, label: realizedPnLLabels[0] });
    if (realizedPnLLabels.length >= 6) {
      const mid = Math.floor((realizedPnLLabels.length - 1) / 2);
      axisTicks.push({ idx: mid, label: realizedPnLLabels[mid] });
    }
    axisTicks.push({
      idx: realizedPnLLabels.length - 1,
      label: realizedPnLLabels[realizedPnLLabels.length - 1],
    });
  }

  const hoveredLabel = hoverIdx !== null && realizedPnLLabels?.[hoverIdx];
  const hoveredValue = hoverIdx !== null ? series[hoverIdx] : null;

  // ── Composition donut geometry ─────────────────────────────────────────
  // Donut on right side. 100×100 viewBox, radius 40, stroke 14 → outer 47, inner 33.
  const compTotal =
    composition.active + composition.forSale + composition.sold + composition.expired;
  const compSlices = [
    { value: composition.active, color: '#0d9488', key: 'active' }, // teal-600
    { value: composition.forSale, color: '#f59e0b', key: 'forSale' }, // amber-500
    { value: composition.sold, color: '#10b981', key: 'sold' }, // emerald-500
    { value: composition.expired, color: '#fb7185', key: 'expired' }, // rose-400
  ];
  // SVG arc helper — circumference of r=40 is 2πr ≈ 251.3
  const C = 2 * Math.PI * 40;
  let cumulativeOffset = 0;
  const donutPaths = compSlices.map((s) => {
    if (compTotal === 0 || s.value === 0) return null;
    const fraction = s.value / compTotal;
    const dash = fraction * C;
    const dashArray = `${dash} ${C - dash}`;
    const dashOffset = -cumulativeOffset;
    cumulativeOffset += dash;
    return { ...s, dashArray, dashOffset };
  });

  // Sales count caption
  const salesCaption =
    completedSalesCount === 0
      ? labels.noSales
      : completedSalesCount === 1
        ? labels.fromOneSale
        : labels.fromSales.replace('{n}', String(completedSalesCount));

  return (
    <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-teal-50/50 via-white to-amber-50/40 shadow-md">
      {/* Decorative corner glow */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-gradient-to-br from-teal-200/40 via-emerald-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-gradient-to-tr from-amber-100/30 to-transparent blur-3xl" />

      <div className="relative p-6 sm:p-8">
        {/* ────── Hero row: two big numbers + composition donut ────── */}
        <div className="grid gap-6 sm:gap-10 lg:grid-cols-[1.5fr_1fr_auto] lg:items-start">
          {/* Left: Realized P&L */}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              {labels.realizedPnL}
            </p>
            <p
              className={`mt-2 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl ${pnlColorClass}`}
            >
              {pnlSign}
              {pnlAbsFormatted}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
              <span className="font-medium text-stone-600">{salesCaption}</span>
              {realizedPnLInWindow !== 0 && (
                <>
                  <span className="text-stone-300">·</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      realizedPnLInWindow > 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {realizedPnLInWindow > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {windowDeltaCaption}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Middle: Portfolio at Cost (slightly subdued vs P&L) */}
          <div className="min-w-0 lg:border-l lg:border-stone-200/70 lg:pl-6 xl:pl-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              {labels.portfolioAtCost}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-stone-900 sm:text-4xl">
              {formatCurrency(portfolioAtCost)}
            </p>
            <p className="mt-2 text-sm text-stone-500">
              <span className="font-medium text-stone-700">
                {labels.heldListed(composition.active, composition.forSale)}
              </span>
            </p>
          </div>

          {/* Right: Composition donut */}
          {compTotal > 0 && (
            <div className="flex items-start gap-3 sm:gap-4 lg:flex-col lg:items-end lg:gap-2">
              <svg viewBox="0 0 100 100" className="h-20 w-20 shrink-0 -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#f5f5f4"
                  strokeWidth="14"
                />
                {donutPaths.map(
                  (p) =>
                    p && (
                      <circle
                        key={p.key}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={p.color}
                        strokeWidth="14"
                        strokeDasharray={p.dashArray}
                        strokeDashoffset={p.dashOffset}
                        strokeLinecap="butt"
                      />
                    )
                )}
              </svg>
              <div className="min-w-0 space-y-1.5 text-xs lg:text-right">
                <div className="flex items-center gap-1.5 lg:justify-end">
                  <span className="h-2 w-2 rounded-full bg-teal-600" />
                  <span className="text-stone-600">
                    {composition.active} <span className="text-stone-400">active</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 lg:justify-end">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-stone-600">
                    {composition.forSale} <span className="text-stone-400">listed</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 lg:justify-end">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-stone-600">
                    {composition.sold} <span className="text-stone-400">sold</span>
                  </span>
                </div>
                {composition.expired > 0 && (
                  <div className="flex items-center gap-1.5 lg:justify-end">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    <span className="text-stone-600">
                      {composition.expired} <span className="text-stone-400">lost</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ────── Sparkline + window selector ────── */}
        <div className="mt-7 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <svg
              viewBox="0 0 200 60"
              className="h-16 w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label={labels.windowCaption}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <defs>
                <linearGradient id="phc-sparkfill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkAccent} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={sparkAccent} stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Zero line — only show when the series crosses zero */}
              {minV < 0 && maxV > 0 && (
                <line
                  x1={4}
                  x2={196}
                  y1={zeroY}
                  y2={zeroY}
                  stroke="#e7e5e4"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
              )}
              {!isSinglePoint && (
                <>
                  <path
                    d={`${sparkPath} L196,${zeroY.toFixed(1)} L4,${zeroY.toFixed(1)} Z`}
                    fill="url(#phc-sparkfill)"
                  />
                  <path
                    d={sparkPath}
                    fill="none"
                    stroke={sparkAccent}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
              {isSinglePoint && (
                <circle cx={100} cy={zeroY} r={4} fill={sparkAccent} />
              )}
              {hoverIdx !== null &&
                (() => {
                  const { x, y } = pointXY(hoverIdx, series[hoverIdx]);
                  return (
                    <g pointerEvents="none">
                      <line
                        x1={x}
                        y1={4}
                        x2={x}
                        y2={56}
                        stroke="#a8a29e"
                        strokeDasharray="2 2"
                        strokeWidth={1}
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r={3.5}
                        fill={sparkAccent}
                        stroke="#fff"
                        strokeWidth={1.5}
                      />
                    </g>
                  );
                })()}
              {/* Hit areas */}
              {series.length > 1 &&
                series.map((_, i) => {
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
            {/* Hover readout / window caption */}
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="truncate text-xs text-stone-500">
                {hoveredLabel && hoveredValue !== null ? (
                  <>
                    <span className="font-medium text-stone-700">{hoveredLabel}</span>
                    {' · '}
                    <span
                      className={`font-semibold tabular-nums ${
                        hoveredValue > 0
                          ? 'text-emerald-600'
                          : hoveredValue < 0
                            ? 'text-rose-600'
                            : 'text-stone-700'
                      }`}
                    >
                      {hoveredValue >= 0 ? '+' : '−'}
                      {formatCurrency(Math.abs(hoveredValue))}
                    </span>
                  </>
                ) : (
                  <span className="font-medium text-stone-600">
                    {labels.windowCaption}
                    {' · '}
                    <span className="text-stone-400">{labels.allTime(formatCurrency(realizedPnLAllTime))}</span>
                  </span>
                )}
              </p>
              {axisTicks.length >= 2 && (
                <p className="hidden shrink-0 text-[10px] tabular-nums text-stone-400 sm:block">
                  {axisTicks[0].label}
                  {' → '}
                  {axisTicks[axisTicks.length - 1].label}
                </p>
              )}
            </div>
          </div>
          {windowOptions && windowOptions.length > 0 && onWindowChange && (
            <div
              role="group"
              aria-label={labels.trendWindowAria}
              className="flex shrink-0 items-center gap-0.5 rounded-lg border border-stone-200 bg-white/80 p-0.5 backdrop-blur-sm"
            >
              {windowOptions.map((opt) => {
                const active = opt.key === selectedWindow;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onWindowChange(opt.key)}
                    aria-pressed={active}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                      active
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ────── Footer chips: secondary metrics ────── */}
        <p className="mt-7 -mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
          {labels.allTimeFooter}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-stone-200/70 pt-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <Globe className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">
                {labels.domains}
              </p>
              <p className="truncate text-sm font-semibold text-stone-900 tabular-nums">
                {totalDomains}
                <span className="ml-1 text-xs font-normal text-stone-500">
                  {labels.activeSold(composition.active, composition.sold)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                roi >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              <Award className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">
                {labels.roi}
              </p>
              <p
                className={`text-sm font-semibold tabular-nums ${
                  roi >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {roi >= 0 ? '+' : ''}
                {roi.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <RefreshCw className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">
                {labels.ytdRenewalSpend}
              </p>
              <p
                className="text-sm font-semibold text-stone-900 tabular-nums"
                title={labels.ytdRenewalSpend}
              >
                {formatCurrency(ytdRenewalSpendAmortized)}
              </p>
              <p className="text-xs text-stone-400 tabular-nums">
                {labels.ytdRenewalCashPaid
                  .replace('{amount}', formatCurrency(ytdRenewalSpendCash))
                  .replace('{year}', String(currentYear))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
