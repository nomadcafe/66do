/**
 * Canvas-drawing helpers for the share modals. All functions operate in
 * an 800x600 logical coordinate space; callers get a retina-crisp PNG
 * because setupDprCanvas scales the backing buffer by devicePixelRatio.
 */

const CANVAS_W = 800;
const CANVAS_H = 600;

/**
 * Resets transform, sizes the backing buffer to devicePixelRatio, and
 * locks the CSS size to 800x600 so the preview and the downloaded PNG
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

/** "2y 3m" / "6m" / "14d" — locale-neutral short form for the overlay. */
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
  /** When present and loaded, draws the celebration-PNG overlay variant. */
  celebrationImage?: HTMLImageElement | null;
}

function drawCelebrationOverlay(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  p: DomainSaleImageParams
): void {
  ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'left';
  // Text overlay anchored under the PNG's "screen" area; coordinates
  // are hand-tuned to the current domainfinancial.png. If the PNG is
  // ever re-exported, these need to move with it.
  const screenLeftX = 120;
  const lineGap = 54;
  let y = 168;
  ctx.font = 'bold 34px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(p.domainName, screenLeftX, y);
  y += lineGap;
  ctx.font = 'bold 36px Inter, Arial, sans-serif';
  ctx.fillStyle = '#22c55e';
  ctx.fillText(`$${p.salePrice.toLocaleString()}`, screenLeftX, y);
  y += lineGap;
  ctx.font = 'bold 38px Inter, Arial, sans-serif';
  ctx.fillText(`ROI: ${p.roi.toFixed(1)}%`, screenLeftX, y);
  y += lineGap;
  ctx.font = 'bold 28px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(`HT: ${p.holdingShort}`, screenLeftX, y);
}

function drawSaleFallbackCard(
  ctx: CanvasRenderingContext2D,
  p: DomainSaleImageParams
): void {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  gradient.addColorStop(0, '#f8fafc');
  gradient.addColorStop(0.5, '#f1f5f9');
  gradient.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  if (typeof ctx.roundRect === 'function') ctx.roundRect(60, 60, 680, 480, 16);
  else ctx.rect(60, 60, 680, 480);
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  if (typeof ctx.roundRect === 'function') ctx.roundRect(60, 60, 680, 480, 16);
  else ctx.rect(60, 60, 680, 480);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.font = 'bold 48px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1e293b';
  ctx.fillText('Domain Sold Successfully', CANVAS_W / 2, 140);

  ctx.font = 'bold 36px Inter, Arial, sans-serif';
  ctx.fillStyle = '#3b82f6';
  ctx.fillText(p.domainName, CANVAS_W / 2, 200);

  ctx.font = 'bold 44px Inter, Arial, sans-serif';
  ctx.fillStyle = '#059669';
  ctx.fillText(`$${p.salePrice.toLocaleString()}`, CANVAS_W / 2, 260);

  ctx.fillStyle = '#059669';
  ctx.fillRect(350, 290, 100, 32);
  ctx.strokeStyle = '#047857';
  ctx.lineWidth = 1;
  ctx.strokeRect(350, 290, 100, 32);
  ctx.font = 'bold 16px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('SOLD', CANVAS_W / 2, 310);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(100, 340);
  ctx.lineTo(700, 340);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 24px Inter, Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Net Profit', 100, 400);
  ctx.font = 'bold 32px Inter, Arial, sans-serif';
  ctx.fillStyle = '#059669';
  ctx.fillText(`$${p.profit.toLocaleString()}`, 100, 430);

  ctx.font = 'bold 24px Inter, Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('ROI', 300, 400);
  ctx.font = 'bold 32px Inter, Arial, sans-serif';
  ctx.fillStyle = '#3b82f6';
  ctx.fillText(`${p.roi.toFixed(1)}%`, 300, 430);

  ctx.font = 'bold 24px Inter, Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Holding Period', 500, 400);
  ctx.font = 'bold 32px Inter, Arial, sans-serif';
  ctx.fillStyle = '#7c3aed';
  ctx.fillText(p.holdingLocalized, 500, 430);

  ctx.font = 'bold 20px Inter, Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText('Powered by Domain.Financial', CANVAS_W / 2, 500);
  ctx.font = '14px Inter, Arial, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Track & Grow Your Domains', CANVAS_W / 2, 520);
}

export function drawDomainSaleImage(canvas: HTMLCanvasElement, p: DomainSaleImageParams): void {
  const ctx = setupDprCanvas(canvas);
  if (!ctx) return;
  const img = p.celebrationImage;
  const useCelebration = img && img.complete && img.naturalWidth > 0;
  if (useCelebration) drawCelebrationOverlay(ctx, img, p);
  else drawSaleFallbackCard(ctx, p);
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

  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  gradient.addColorStop(0, '#faf8f5');
  gradient.addColorStop(0.45, '#f3efe8');
  gradient.addColorStop(1, '#e8e2d8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const profit = Number.isFinite(p.totalProfit) ? p.totalProfit : 0;
  const roiVal = Number.isFinite(p.roi) ? p.roi : 0;
  const investment = Number.isFinite(p.totalInvestment) ? p.totalInvestment : 0;
  const bestName = p.bestDomain && p.bestDomain !== '—' ? p.bestDomain : '—';
  const bestTrunc = bestName.length > 32 ? `${bestName.slice(0, 29)}...` : bestName;
  const ink = '#1c1917';
  const muted = '#57534e';
  const soft = '#78716c';

  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 38px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p.labels.title, CANVAS_W / 2, 100);

  ctx.fillStyle = muted;
  ctx.font = '24px Inter, Arial, sans-serif';
  ctx.fillText(p.labels.totalProfit, CANVAS_W / 2, 180);
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 48px Inter, Arial, sans-serif';
  ctx.fillText(`$${profit.toLocaleString()}`, CANVAS_W / 2, 240);

  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 36px Inter, Arial, sans-serif';
  ctx.fillText(`ROI: ${roiVal.toFixed(1)}%`, CANVAS_W / 2, 300);

  ctx.fillStyle = ink;
  ctx.font = '20px Inter, Arial, sans-serif';
  ctx.fillText(`${p.labels.bestDomain}: ${bestTrunc}`, CANVAS_W / 2, 350);

  ctx.fillStyle = soft;
  ctx.font = '18px Inter, Arial, sans-serif';
  ctx.fillText(
    `${p.labels.totalInvestment}: $${investment.toLocaleString()}  ·  ${p.labels.investmentPeriod}: ${p.investmentPeriod}`,
    CANVAS_W / 2,
    400
  );

  ctx.fillStyle = '#a8a29e';
  ctx.font = '16px Inter, Arial, sans-serif';
  ctx.fillText('powered by', CANVAS_W / 2, 520);
  ctx.fillStyle = '#166534';
  ctx.font = 'bold 20px Inter, Arial, sans-serif';
  ctx.fillText('Domain.financial', CANVAS_W / 2, 550);
}

/** Triggers a browser download of the canvas as a PNG. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL();
  link.click();
}
