'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';

export interface ListPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
  /** Shown under controls when provided */
  rangeSummary?: string;
}

export function ListPagination({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5,
  rangeSummary,
}: ListPaginationProps) {
  const { t } = useI18nContext();

  const visiblePages = useMemo(() => {
    const pages: (number | string)[] = [];
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, currentPage + halfVisible);

    if (endPage - startPage + 1 < maxVisiblePages) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      } else {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
    }

    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) pages.push('...');
    }
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages, maxVisiblePages]);

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
      {rangeSummary ? (
        <p className="text-sm text-stone-500 order-2 sm:order-1">{rangeSummary}</p>
      ) : (
        <span className="order-2 sm:order-1" />
      )}
      <nav
        className="flex items-center justify-center gap-1 order-1 sm:order-2"
        aria-label={t('common.paginationNav')}
      >
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t('common.paginationPrev')}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {visiblePages.map((p, i) =>
          p === '...' ? (
            <span key={`e-${i}`} className="px-2 text-sm text-stone-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              className={`min-w-[2.25rem] rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                p === currentPage
                  ? 'border-teal-600 bg-teal-600 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t('common.paginationNext')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
