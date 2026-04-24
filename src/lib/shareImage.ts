/**
 * Canvas-drawing helpers for the share modals. All functions operate in a
 * 1200x630 logical coordinate space (the standard OG / Twitter summary
 * card aspect). setupDprCanvas scales the backing buffer by
 * devicePixelRatio so downloads stay crisp on retina and at 2x social
 * feed sizes.
 */

const CANVAS_W = 1200;
const CANVAS_H = 630;

/**
 * Resets transform, sizes the backing buffer to devicePixelRatio, and
 * locks the CSS size to 1200x630 so the preview and the downloaded PNG
 * both reason in the same coordinate system.
 */
export function setupDprCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  canvas.style.width = `${CANVAS_W}px`;
  canvas.style.height = `${CANVAS_H}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  return ctx;
}

/**
 * `1234` -> `$1,234`, `-1234` -> `-$1,234`. Using plain
 * `$${n.toLocaleString()}` produced `$-1,234` which reads wrong.
 */
export function formatUSD(n: number): string {
  return n < 0
    ? `-$${Math.abs(n).toLocaleString()}`
    : `$${n.toLocaleString()}`;
}

/** `18500` -> `+$18.5K`, `1800000` -> `+$1.8M`. For compact metric cells. */
function formatCompactUSD(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  let body: string;
  if (abs >= 1_000_000) body = `$${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 10_000) body = `$${(abs / 1_000).toFixed(1)}K`;
  else body = `$${abs.toLocaleString()}`;
  return `${sign}${body}`;
}

/** "2y 3m" / "6m" / "14d" — locale-neutral short form. */
export function holdingPeriodShort(purchase: Date, sale: Date): string {
  const a = purchase.getTime();
  const b = sale.getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '—';
  const diffDays = Math.ceil(Math.abs(b - a) / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return `${diffDays}d`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}m`;
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  return months > 0 ? `${years}y ${months}m` : `${years}y`;
}

/** Localized via i18n strings the caller passes in (plural forms). */
export interface HoldingPeriodLabels {
  days: string;
  months: string;
  years: string;
}

export function holdingPeriodLocalized(
  purchase: Date,
  sale: Date,
  labels: HoldingPeriodLabels
): string {
  const a = purchase.getTime();
  const b = sale.getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '—';
  const diffDays = Math.ceil(Math.abs(b - a) / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return `${diffDays}${labels.days}`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}${labels.months}`;
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  return months > 0 ? `${years}${labels.years}${months}${labels.months}` : `${years}${labels.years}`;
}

// ---- Domain-sale card ---------------------------------------------------

export interface DomainSaleImageParams {
  domainName: string;
  salePrice: number;
  profit: number;
  roi: number;
  holdingShort: string;
  holdingLocalized: string;
  /** Drives colour / copy. When false the card uses a neutral loss palette. */
  isProfit?: boolean;
}

const FONT = 'Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif';

// Palette
const INK = '#1c1917';          // domain name, primary
const MUTED = '#57534e';         // badge label
const LABEL = '#78716c';         // metric labels
const DIVIDER = '#e7e5e4';       // hairline separators
const BRAND_TEAL = '#0d9488';    // accent for profit mode
const BRAND_SLATE = '#64748b';   // accent for loss mode
const PROFIT = '#16a34a';        // metric green
const LOSS = '#dc2626';          // metric red
const HOLDING = '#7c3aed';       // holding value (neutral data)

function fillGradientBackground(ctx: CanvasRenderingContext2D, isProfit: boolean) {
  const wash = isProfit ? '#f0fdfa' /* teal-50 */ : '#f8fafc' /* slate-50 */;
  const base = '#fafaf9'; // stone-50
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, wash);
  g.addColorStop(1, base);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

/**
 * Drops font size until `text` fits within `maxWidth` at the given weight.
 * Returns the font-size actually used so callers can adjust follow-on layout
 * (not needed yet but cheap to expose).
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxPx: number,
  minPx: number,
  weight: string
): number {
  let size = maxPx;
  while (size > minPx) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  ctx.font = `${weight} ${minPx}px ${FONT}`;
  return minPx;
}

function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, accent: string) {
  // Small dot + uppercase label, letter-spaced.
  ctx.beginPath();
  ctx.fillStyle = accent;
  ctx.arc(x + 8, y - 4, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `600 22px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Manual letter-spacing: canvas 2D has no built-in tracking so we
  // walk the string and offset by measureText each step. Cheap at
  // this text length.
  const tracking = 2;
  let cx = x + 28;
  for (const ch of label) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}

function drawMetricCell(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  valueY: number,
  labelY: number,
  value: string,
  label: string,
  valueColor: string
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = valueColor;
  ctx.font = `700 48px ${FONT}`;
  ctx.fillText(value, centerX, valueY);

  ctx.fillStyle = LABEL;
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(label, centerX, labelY);
}

/**
 * Renders a centered brand watermark at the bottom of the card:
 * `● Domain.Financial` in the brand teal, big enough to be the last thing
 * the viewer sees but not so big it fights the hero data. Always teal
 * regardless of profit/loss -- the product name shouldn't change colour
 * based on a single deal.
 */
function drawCenteredWatermark(ctx: CanvasRenderingContext2D, y: number) {
  const label = 'Domain.Financial';
  ctx.font = `700 32px ${FONT}`;
  const textWidth = ctx.measureText(label).width;
  const dotRadius = 8;
  const dotGap = 16;
  const groupWidth = dotRadius * 2 + dotGap + textWidth;
  const startX = CANVAS_W / 2 - groupWidth / 2;

  ctx.beginPath();
  ctx.fillStyle = BRAND_TEAL;
  ctx.arc(startX + dotRadius, y - 10, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = BRAND_TEAL;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, startX + dotRadius * 2 + dotGap, y);
}

export function drawDomainSaleImage(canvas: HTMLCanvasElement, p: DomainSaleImageParams): void {
  const ctx = setupDprCanvas(canvas);
  if (!ctx) return;
  const isProfit = p.isProfit !== false;
  const accent = isProfit ? BRAND_TEAL : BRAND_SLATE;
  const pnlColor = isProfit ? PROFIT : LOSS;

  // 80px safe margin on all sides; content area is 1040 wide.
  const margin = 80;
  const contentRight = CANVAS_W - margin;

  fillGradientBackground(ctx, isProfit);

  // Top-right celebration emoji (profit only). Loss mode stays clean --
  // a party popper next to `POSITION CLOSED / -$500` reads as sarcastic.
  if (isProfit) {
    ctx.font = `100px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('🎉', contentRight, 170);
  }

  // Badge (top)
  drawBadge(
    ctx,
    margin,
    108,
    isProfit ? 'DOMAIN SOLD' : 'POSITION CLOSED',
    accent
  );

  // Domain name (hero 1). Cap its max width a bit short of the canvas
  // edge so a long name never crashes into the emoji.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  const heroMaxWidth = isProfit ? CANVAS_W - margin * 2 - 140 : CANVAS_W - margin * 2;
  fitText(ctx, p.domainName, heroMaxWidth, 72, 40, '800');
  ctx.fillText(p.domainName, margin, 210);

  // Sale price (hero 2)
  ctx.fillStyle = accent;
  const priceStr = formatUSD(p.salePrice);
  fitText(ctx, priceStr, CANVAS_W - margin * 2, 96, 64, '800');
  ctx.fillText(priceStr, margin, 340);

  // "Sale Price" label under the hero number
  ctx.fillStyle = LABEL;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText('Sale Price', margin, 380);

  // Divider
  ctx.strokeStyle = DIVIDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, 420);
  ctx.lineTo(contentRight, 420);
  ctx.stroke();

  // Three metric cells: Net Profit / ROI / Held
  // Evenly spaced columns within the content area.
  const col1X = margin + 1040 / 6;        // 80 + 173 = 253
  const col2X = margin + 1040 / 2;        // 80 + 520 = 600
  const col3X = margin + (1040 / 6) * 5;  // 80 + 867 = 947
  const metricValueY = 495;
  const metricLabelY = 535;

  drawMetricCell(
    ctx,
    col1X,
    metricValueY,
    metricLabelY,
    formatCompactUSD(p.profit),
    isProfit ? 'Profit' : 'Loss',
    pnlColor
  );

  drawMetricCell(
    ctx,
    col2X,
    metricValueY,
    metricLabelY,
    `${p.roi >= 0 ? '+' : ''}${p.roi.toFixed(1)}%`,
    'ROI',
    pnlColor
  );

  drawMetricCell(
    ctx,
    col3X,
    metricValueY,
    metricLabelY,
    p.holdingShort,
    'Held',
    HOLDING
  );

  // Column separators — subtle vertical hairlines between the metric cells.
  ctx.strokeStyle = DIVIDER;
  ctx.lineWidth = 1;
  const sep1X = margin + 1040 / 3;
  const sep2X = margin + (1040 / 3) * 2;
  [sep1X, sep2X].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, 455);
    ctx.lineTo(x, 555);
    ctx.stroke();
  });

  drawCenteredWatermark(ctx, 612);
}

// ---- Portfolio card -----------------------------------------------------

export interface PortfolioImageLabels {
  title: string;
  totalProfit: string;
  bestDomain: string;
  totalInvestment: string;
  investmentPeriod: string;
}

export interface PortfolioImageParams {
  totalProfit: number;
  roi: number;
  bestDomain: string;
  totalInvestment: number;
  investmentPeriod: string;
  labels: PortfolioImageLabels;
}

export function drawPortfolioImage(canvas: HTMLCanvasElement, p: PortfolioImageParams): void {
  const ctx = setupDprCanvas(canvas);
  if (!ctx) return;

  const profit = Number.isFinite(p.totalProfit) ? p.totalProfit : 0;
  const roiVal = Number.isFinite(p.roi) ? p.roi : 0;
  const investment = Number.isFinite(p.totalInvestment) ? p.totalInvestment : 0;
  const isProfit = profit >= 0;
  const accent = isProfit ? BRAND_TEAL : BRAND_SLATE;
  const pnlColor = isProfit ? PROFIT : LOSS;

  const margin = 80;
  const contentRight = CANVAS_W - margin;

  fillGradientBackground(ctx, isProfit);

  // Top-right emoji accent. 📊 is neutral and always appropriate for a
  // portfolio view, regardless of whether this period is net positive.
  ctx.font = `100px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('📊', contentRight, 170);

  // Badge
  drawBadge(ctx, margin, 108, 'PORTFOLIO SUMMARY', accent);

  // Title (small, single line under the badge). Constrain its width so
  // a long localized title never crashes into the emoji.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  const titleMaxWidth = CANVAS_W - margin * 2 - 140;
  fitText(ctx, p.labels.title, titleMaxWidth, 44, 28, '700');
  ctx.fillText(p.labels.title, margin, 180);

  // Hero: total profit with localized label above
  ctx.fillStyle = LABEL;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText(p.labels.totalProfit, margin, 240);
  ctx.fillStyle = accent;
  const profitStr = formatUSD(profit);
  fitText(ctx, profitStr, CANVAS_W - margin * 2, 88, 56, '800');
  ctx.fillText(profitStr, margin, 335);

  // "Top performer: premium.com" as a caption under the hero --
  // preserves the info that used to live in the bottom-right corner,
  // where it competed with the (now-centered) brand watermark.
  const bestName = p.bestDomain && p.bestDomain !== '—' ? p.bestDomain : '';
  if (bestName) {
    const bestTrunc = bestName.length > 32 ? `${bestName.slice(0, 29)}...` : bestName;
    ctx.font = `500 20px ${FONT}`;
    ctx.fillStyle = LABEL;
    ctx.fillText(`${p.labels.bestDomain}: ${bestTrunc}`, margin, 380);
  }

  // Divider
  ctx.strokeStyle = DIVIDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, 420);
  ctx.lineTo(contentRight, 420);
  ctx.stroke();

  // Three metric cells: ROI / Total Investment / Investment Period
  const col1X = margin + 1040 / 6;
  const col2X = margin + 1040 / 2;
  const col3X = margin + (1040 / 6) * 5;
  const metricValueY = 495;
  const metricLabelY = 535;

  drawMetricCell(
    ctx,
    col1X,
    metricValueY,
    metricLabelY,
    `${roiVal >= 0 ? '+' : ''}${roiVal.toFixed(1)}%`,
    'ROI',
    pnlColor
  );

  drawMetricCell(
    ctx,
    col2X,
    metricValueY,
    metricLabelY,
    formatCompactUSD(investment),
    p.labels.totalInvestment,
    INK
  );

  drawMetricCell(
    ctx,
    col3X,
    metricValueY,
    metricLabelY,
    p.investmentPeriod,
    p.labels.investmentPeriod,
    HOLDING
  );

  ctx.strokeStyle = DIVIDER;
  ctx.lineWidth = 1;
  const sep1X = margin + 1040 / 3;
  const sep2X = margin + (1040 / 3) * 2;
  [sep1X, sep2X].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, 455);
    ctx.lineTo(x, 555);
    ctx.stroke();
  });

  drawCenteredWatermark(ctx, 612);
}

/** Triggers a browser download of the canvas as a PNG. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL();
  link.click();
}
