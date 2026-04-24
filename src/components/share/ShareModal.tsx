'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Download } from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags } from '../../types/dashboard';
import type { TransactionWithRequiredFields } from '../../types/transaction';
import { calculateBasicFinancialMetrics, sellNetUSD } from '../../lib/coreCalculations';
import { totalHoldingCostForDomain } from '../../lib/renewalCostBasis';
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

function domainProfit(domain: DomainWithTags, transactions: TransactionWithRequiredFields[]): number {
  if (!domain.sale_price) return 0;
  const totalHoldingCost = totalHoldingCostForDomain(domain, transactions);
  const platformFee = domain.platform_fee || 0;
  return domain.sale_price - totalHoldingCost - platformFee;
}

function domainROI(domain: DomainWithTags, transactions: TransactionWithRequiredFields[]): number {
  const totalHoldingCost = totalHoldingCostForDomain(domain, transactions);
  const profit = domainProfit(domain, transactions);
  return totalHoldingCost > 0 ? (profit / totalHoldingCost) * 100 : 0;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function filterByRange(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[],
  range: PortfolioRange
): { domains: DomainWithTags[]; transactions: TransactionWithRequiredFields[] } {
  if (range === 'all') return { domains, transactions };
  const years = range === '1y' ? 1 : range === '2y' ? 2 : 3;
  const cutoff = Date.now() - years * 365 * MS_PER_DAY;
  const filteredDomains = domains.filter((d) => {
    const purchase = d.purchase_date ? new Date(d.purchase_date).getTime() : 0;
    return purchase >= cutoff || !d.purchase_date;
  });
  const filteredTransactions = transactions.filter((t) => new Date(t.date).getTime() >= cutoff);
  return { domains: filteredDomains, transactions: filteredTransactions };
}

function computeShareDataFromData(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[],
  locale: 'zh' | 'en'
): ShareData {
  const metrics = calculateBasicFinancialMetrics(domains, transactions);
  const totalInvestment = metrics.totalInvestment;
  const totalProfit = metrics.totalProfit;
  const roi = metrics.roi;

  const sellTxByDomainId = transactions.filter((t) => t.type === 'sell').reduce((acc, t) => {
    const id = t.domain_id;
    acc[id] = (acc[id] || 0) + sellNetUSD(t);
    return acc;
  }, {} as Record<string, number>);

  let bestDomain: DomainWithTags | null = null;
  let bestProfit = -Infinity;
  for (const domain of domains) {
    const revenue = sellTxByDomainId[domain.id] ?? 0;
    if (revenue <= 0) continue;
    const holdingCost = totalHoldingCostForDomain(domain, transactions);
    const profit = revenue - holdingCost;
    if (profit > bestProfit) {
      bestProfit = profit;
      bestDomain = domain;
    }
  }

  const domainsWithPurchaseDate = domains.filter((d) => d.purchase_date);
  const purchaseDates = domainsWithPurchaseDate.map((d) => new Date(d.purchase_date!).getTime());
  const transactionDates = transactions.map((t) => new Date(t.date).getTime());
  const saleDates = domains.filter((d) => d.sale_date).map((d) => new Date(d.sale_date!).getTime());
  const now = Date.now();
  const startMs = purchaseDates.length > 0 ? Math.min(...purchaseDates) : now;
  const endMs = Math.max(now, ...transactionDates, ...saleDates, startMs);
  const days = Math.max(0, Math.floor((endMs - startMs) / MS_PER_DAY));
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
  const mascotImage = useMascotImage();
  const [shareMode, setShareMode] = useState<'portfolio' | 'single'>('portfolio');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [portfolioRange, setPortfolioRange] = useState<PortfolioRange>('all');

  const soldDomains = useMemo(() => shareData.soldDomains ?? [], [shareData.soldDomains]);
  const selectedDomain = selectedDomainId ? soldDomains.find((d) => d.id === selectedDomainId) ?? null : null;

  const portfolioShareData = useMemo(() => {
    if (domains.length === 0 || transactions.length === 0) return shareData;
    const { domains: filteredDomains, transactions: filteredTransactions } = filterByRange(domains, transactions, portfolioRange);
    return computeShareDataFromData(filteredDomains, filteredTransactions, locale);
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
        mascotImage,
      });
    } else {
      drawPortfolioImage(canvasRef.current, {
        totalProfit: effectivePortfolioData.totalProfit,
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
      });
    }
  }, [shareMode, selectedDomain, effectivePortfolioData, transactions, t, mascotImage]);

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
