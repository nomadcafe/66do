'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Download } from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags } from '../../types/dashboard';
import type { TransactionWithRequiredFields } from '../../types/transaction';
import { domainSaleProfit, domainSaleROI } from '../../lib/domainSaleOutcome';
import { realizedROIFromTrades, tradeOutcomes } from '../../lib/realizedPnL';
import {
  drawDomainSaleImage,
  drawPortfolioImage,
  downloadCanvas,
  holdingPeriodShort,
  holdingPeriodLocalized,
} from '../../lib/shareImage';
import { investedTweetText, portfolioTweetText, shareToX } from '../../lib/shareText';
import { useMascotImage } from '../../hooks/useMascotImage';
import ModalShell from './ModalShell';
import { parseLocalCalendarDate } from '../../lib/localCalendarDate';

export interface ShareData {
  totalProfit: number;
  roi: number;
  bestDomain: string;
  investmentPeriod: string;
  domainCount: number;
  totalInvestment: number;
  soldDomains?: DomainWithTags[];
}

type PortfolioRange = '1y' | '2y' | '3y' | 'all';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: ShareData;
  /** When provided with transactions, portfolio summary can be filtered by time range (1y/2y/3y/all). */
  domains?: DomainWithTags[];
  transactions?: TransactionWithRequiredFields[];
}

// 利润 / ROI 走 lib 里的主口径（与 Insights 的 Top Performers 同源）。
// 这里原本是一份基于 domain.sale_price 的私有实现，DomainShareModal 里还有
// 一份一模一样的拷贝——详见 domainSaleOutcome 的注释。
const domainProfit = domainSaleProfit;
const domainROI = domainSaleROI;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 窗口起点（含）。'all' 没有起点。
 *
 *  按自然年往回推，而不是 years × 365 天——后者每 4 年少算一天，"Last 2 years"
 *  实际是 730 天。跟 Insights 时间窗口选择器一样锚在当下。 */
function rangeCutoffMs(range: PortfolioRange): number | null {
  if (range === 'all') return null;
  const years = range === '1y' ? 1 : range === '2y' ? 2 : 3;
  const now = new Date();
  return new Date(now.getFullYear() - years, now.getMonth(), now.getDate()).getTime();
}

/**
 * 分享卡片上的四个数。
 *
 * 口径必须和用户刚刚在仪表盘上看到的一致，否则发出去的图和自己的后台对不上：
 *   - 全部走 tradeOutcomes（每笔 sell 一行，cost basis 取 holdingCostAsOf，
 *     与 Insights 的 Top Performers / Realized ROI 同源）
 *   - ROI = Σprofit / Σcost basis，即 realizedROI。以前用的是
 *     calculateBasicFinancialMetrics.roi，分母含**没卖出的库存成本**——
 *     useDomainStats 早就因为这个把它换掉了（"could be deeply negative while
 *     Realized P&L is positive"），仪表盘改了，这张要发出去的图没跟上：
 *     同一批数据分享卡片 190.3%、仪表盘 1400.0%，标签都写着 ROI。
 *
 * 时间范围同样不能靠裁数据实现。以前是 filterByRange 按 purchase_date /
 * tx.date 把 domains 和 transactions 都截一刀再喂给计算——2023 年买、2026 年
 * 卖的域名在"近 2 年"档里域名本身被滤掉了，它的 sell 交易却留着：成本凭空
 * 消失、利润凭空变大。InvestmentAnalytics 里那段长注释警告的就是这个。
 * 正确做法是全量数据算 trade，再按**成交日**落不落在窗口里筛。
 */
function computeShareDataFromData(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[],
  range: PortfolioRange,
  locale: 'zh' | 'en'
): ShareData {
  const cutoff = rangeCutoffMs(range);
  const timeOf = (v: string | null | undefined) =>
    (parseLocalCalendarDate(v) ?? new Date(NaN)).getTime();

  const trades = tradeOutcomes(domains, transactions).filter((tr) => {
    if (cutoff === null) return true;
    const t = timeOf(tr.saleDate);
    return Number.isFinite(t) && t >= cutoff;
  });

  const totalProfit = trades.reduce((sum, tr) => sum + tr.profit, 0);
  // 分母是这些已成交域名的 cost basis 之和，跟 totalProfit / roi 同一批交易。
  const totalInvestment = trades.reduce((sum, tr) => sum + tr.costBasisAtSale, 0);
  const roi = realizedROIFromTrades(trades);

  let bestDomain: DomainWithTags | null = null;
  let bestProfit = -Infinity;
  const domainsById = new Map(domains.map((d) => [d.id, d]));
  for (const tr of trades) {
    if (tr.profit <= 0) continue;
    if (tr.profit > bestProfit) {
      bestProfit = tr.profit;
      bestDomain = domainsById.get(tr.domainId) ?? null;
    }
  }

  // 投资时长：最早购入日（不早于窗口起点）到现在。走 parseLocalCalendarDate
  // 而不是 new Date(str)——后者按 UTC 解析 'YYYY-MM-DD'，负偏移时区会早一天。
  const purchaseDates = domains
    .filter((d) => d.purchase_date)
    .map((d) => timeOf(d.purchase_date))
    .filter((ms) => Number.isFinite(ms));
  const now = Date.now();
  let startMs = purchaseDates.length > 0 ? Math.min(...purchaseDates) : now;
  if (cutoff !== null) startMs = Math.max(startMs, cutoff);
  const days = Math.max(0, Math.floor((now - startMs) / MS_PER_DAY));
  let investmentPeriod: string;
  if (days === 0) investmentPeriod = '—';
  else if (days < 30) investmentPeriod = locale === 'zh' ? `${days}天` : `${days} days`;
  else if (days < 365) investmentPeriod = locale === 'zh' ? `${Math.floor(days / 30)}个月` : `${Math.floor(days / 30)} months`;
  else {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    investmentPeriod = locale === 'zh' ? `${years}年${months}个月` : `${years}y ${months}mo`;
  }

  return {
    totalProfit,
    roi,
    bestDomain: bestDomain?.domain_name ?? '—',
    investmentPeriod,
    domainCount: domains.length,
    totalInvestment
  };
}

export default function ShareModal({ isOpen, onClose, shareData, domains = [], transactions = [] }: ShareModalProps) {
  const { t, locale } = useI18nContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mascots = useMascotImage();
  const [shareMode, setShareMode] = useState<'portfolio' | 'single'>('portfolio');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [portfolioRange, setPortfolioRange] = useState<PortfolioRange>('all');

  const soldDomains = useMemo(() => shareData.soldDomains ?? [], [shareData.soldDomains]);
  const selectedDomain = selectedDomainId ? soldDomains.find((d) => d.id === selectedDomainId) ?? null : null;

  const portfolioShareData = useMemo(() => {
    if (domains.length === 0 || transactions.length === 0) return shareData;
    // 传全量：时间范围在 computeShareDataFromData 内部按成交日筛，
    // 不能在这里先把 domains / transactions 截短（会丢掉成本基准）。
    return computeShareDataFromData(domains, transactions, portfolioRange, locale);
  }, [domains, transactions, portfolioRange, locale, shareData]);

  const effectivePortfolioData = useMemo(() => ({
    ...portfolioShareData,
    soldDomains: shareData.soldDomains
  }), [portfolioShareData, shareData.soldDomains]);

  const drawCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    if (shareMode === 'single' && selectedDomain) {
      const purchaseDate = new Date(selectedDomain.purchase_date || '');
      const saleDate = selectedDomain.sale_date ? new Date(selectedDomain.sale_date) : new Date();
      const profit = domainProfit(selectedDomain, transactions);
      drawDomainSaleImage(canvasRef.current, {
        domainName: selectedDomain.domain_name,
        salePrice: selectedDomain.sale_price ?? 0,
        profit,
        roi: domainROI(selectedDomain, transactions),
        holdingShort: holdingPeriodShort(purchaseDate, saleDate),
        holdingLocalized: holdingPeriodLocalized(purchaseDate, saleDate, {
          days: t('common.days'),
          months: t('common.months'),
          years: t('common.years'),
        }),
        isProfit: profit >= 0,
        mascotImage: profit >= 0 ? mascots.happy : mascots.sad,
      });
    } else {
      const portfolioProfit = effectivePortfolioData.totalProfit;
      drawPortfolioImage(canvasRef.current, {
        totalProfit: portfolioProfit,
        roi: effectivePortfolioData.roi,
        bestDomain: effectivePortfolioData.bestDomain,
        totalInvestment: effectivePortfolioData.totalInvestment,
        investmentPeriod: effectivePortfolioData.investmentPeriod,
        labels: {
          title: t('share.canvasTitle'),
          totalProfit: t('share.totalProfit'),
          bestDomain: t('share.bestDomain'),
          totalInvestment: t('share.totalInvestment'),
          investmentPeriod: t('share.investmentPeriod'),
        },
        mascotImage: portfolioProfit >= 0 ? mascots.happy : mascots.sad,
      });
    }
  }, [shareMode, selectedDomain, effectivePortfolioData, transactions, t, mascots.happy, mascots.sad]);

  useEffect(() => {
    if (!isOpen) return;
    if (shareMode === 'single' && soldDomains.length > 0 && !selectedDomainId) {
      setSelectedDomainId(soldDomains[0].id);
    }
    const timer = setTimeout(() => drawCanvas(), 100);
    return () => clearTimeout(timer);
  }, [isOpen, shareMode, selectedDomainId, soldDomains, drawCanvas]);

  useEffect(() => {
    if (isOpen) {
      setShareMode('portfolio');
      setSelectedDomainId('');
    }
  }, [isOpen]);

  const onDownload = () => {
    if (!canvasRef.current) return;
    drawCanvas();
    const base = shareMode === 'single' && selectedDomain
      ? `domain-financial-domain-success-${selectedDomain.domain_name}`
      : 'domain-financial-investment-results';
    downloadCanvas(canvasRef.current, `${base}-${new Date().toISOString().split('T')[0]}.png`);
  };

  const onShareX = () => {
    if (shareMode === 'single' && selectedDomain) {
      shareToX(investedTweetText({
        domainName: selectedDomain.domain_name,
        profit: domainProfit(selectedDomain, transactions),
        roi: domainROI(selectedDomain, transactions),
      }));
      return;
    }
    const profit = Number.isFinite(portfolioShareData.totalProfit) ? portfolioShareData.totalProfit : 0;
    const roi = Number.isFinite(portfolioShareData.roi) ? portfolioShareData.roi : 0;
    shareToX(portfolioTweetText({ profit, roi }));
  };

  const hasData = shareMode === 'portfolio' ? portfolioShareData.domainCount > 0 : shareData.domainCount > 0;
  const canSelectSingle = soldDomains.length > 0;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboard.shareResults')}
      ariaLabel={t('dashboard.shareResults')}
      closeLabel={t('common.close')}
      panelClassName="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-stone-200/80 shadow-xl"
    >
      <div className="p-6">
        {!hasData && (
          <p className="text-sm text-stone-500 mb-4 p-3 bg-stone-50 rounded-xl border border-stone-200/80">
            {t('share.emptyHint')}
          </p>
        )}

        {hasData && (
          <div className="mb-6">
            {(canSelectSingle && (
              <>
                <h3 className="text-sm font-medium text-stone-700 mb-2">{t('share.selectDomain')}</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="shareMode"
                      checked={shareMode === 'portfolio'}
                      onChange={() => setShareMode('portfolio')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-stone-700">{t('share.shareModePortfolio')}</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="shareMode"
                      checked={shareMode === 'single'}
                      onChange={() => {
                        setShareMode('single');
                        if (soldDomains.length > 0 && !selectedDomainId) setSelectedDomainId(soldDomains[0].id);
                      }}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-stone-700">{t('share.shareModeSingle')}</span>
                  </label>
                  {shareMode === 'single' && (
                    <select
                      value={selectedDomainId}
                      onChange={(e) => setSelectedDomainId(e.target.value)}
                      className="ml-2 px-3 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      aria-label={t('share.selectDomain')}
                    >
                      {soldDomains.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.domain_name} {d.sale_price != null ? `($${d.sale_price.toLocaleString()})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </>
            )) || (shareMode === 'portfolio' && <h3 className="text-sm font-medium text-stone-700 mb-2">{t('share.shareModePortfolio')}</h3>)}
            {shareMode === 'portfolio' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-stone-600">{t('share.portfolioTimeRange')}:</span>
                <select
                  value={portfolioRange}
                  onChange={(e) => setPortfolioRange(e.target.value as PortfolioRange)}
                  className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  aria-label={t('share.portfolioTimeRange')}
                >
                  <option value="1y">{t('share.range1y')}</option>
                  <option value="2y">{t('share.range2y')}</option>
                  <option value="3y">{t('share.range3y')}</option>
                  <option value="all">{t('share.rangeAll')}</option>
                </select>
              </div>
            )}
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-lg font-medium text-stone-900 mb-4">{t('common.shareImagePreview')}</h3>
          <div className="border-2 border-dashed border-stone-200 rounded-xl p-4 bg-stone-50/80">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto mx-auto block"
              style={{ maxHeight: '400px' }}
            />
          </div>
        </div>

        {/* LinkedIn/Facebook sharers can't attach the canvas image; removed. */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-stone-900">{t('common.shareToSocialMedia')}</h3>
          <button
            onClick={onShareX}
            className="w-full flex items-center justify-center gap-2 bg-stone-800 text-white px-4 py-3 rounded-xl hover:bg-stone-700 font-medium"
          >
            <span className="text-lg font-bold">𝕏</span>
            <span>X</span>
          </button>
          <div className="flex justify-center">
            <button
              onClick={onDownload}
              className="flex items-center gap-2 bg-stone-600 text-white px-6 py-3 rounded-xl hover:bg-stone-700"
            >
              <Download className="h-5 w-5" />
              <span>{t('common.downloadImage')}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
