import { AlertTriangle, Award, Calendar, FileText, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import type { BriefingCard } from './WeeklyBriefing';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

interface BuildWeeklyBriefingCardsInput {
  expiringThisWeek: DomainWithTags[];
  expiringThisWeekCost: number;
  recentTransactions: TransactionWithRequiredFields[];
  stuckDomains: DomainWithTags[];
  domains: DomainWithTags[];
  t: (key: string) => string;
  formatCurrency: (n: number) => string;
  formatTransactionDate: (date: string) => string;
  onRenew: (domain: DomainWithTags) => void;
  onViewActivity: () => void;
  /** Element id of the domain list section so the "review" card can scroll to it. */
  domainListAnchorId: string;
}

/**
 * Builds the three-card payload for the WeeklyBriefing component on the
 * Portfolio tab. Pulled out of dashboard/page.tsx where it had grown to
 * an 80-line inline array literal — too dense to read or modify safely.
 *
 * Each card has a "live" branch (something to do) and a calm "empty"
 * branch (you're good). Order is intentional: expiry → activity → stuck.
 */
export function buildWeeklyBriefingCards({
  expiringThisWeek,
  expiringThisWeekCost,
  recentTransactions,
  stuckDomains,
  domains,
  t,
  formatCurrency,
  formatTransactionDate,
  onRenew,
  onViewActivity,
  domainListAnchorId,
}: BuildWeeklyBriefingCardsInput): BriefingCard[] {
  const expiringCard: BriefingCard = expiringThisWeek.length > 0
    ? {
        icon: <AlertTriangle className="h-4 w-4" />,
        iconBg: 'bg-rose-50 text-rose-600',
        title: t('dashboard.briefingExpiringTitle'),
        // When there's only one expiring domain, name it directly so the
        // "Renew" action isn't ambiguous. With multiple, fall back to the
        // count phrase and let the user disambiguate via the list anchor.
        primary: expiringThisWeek.length === 1
          ? expiringThisWeek[0].domain_name
          : t('dashboard.briefingExpiringPrimary').replace('{count}', String(expiringThisWeek.length)),
        secondary: expiringThisWeekCost > 0
          ? t('dashboard.briefingExpiringSecondary').replace('{cost}', formatCurrency(expiringThisWeekCost))
          : undefined,
        // Single domain → renew action goes straight to that one's modal.
        // Multiple domains → "Review" instead, scrolling to the list so the
        // user can pick which one to renew. We never auto-pick "the first".
        action: expiringThisWeek.length === 1
          ? {
              label: t('common.renew'),
              onClick: () => onRenew(expiringThisWeek[0]),
            }
          : {
              label: t('dashboard.briefingReview'),
              onClick: () => {
                document
                  .getElementById(domainListAnchorId)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              },
            },
      }
    : {
        icon: <Calendar className="h-4 w-4" />,
        iconBg: 'bg-stone-100 text-stone-500',
        title: t('dashboard.briefingExpiringTitle'),
        primary: t('dashboard.briefingExpiringNone'),
        secondary: t('dashboard.briefingExpiringNoneHint'),
        empty: true,
      };

  const tx = recentTransactions[0];
  const activityCard: BriefingCard = tx
    ? (() => {
        const dom = domains.find((d) => d.id === tx.domain_id);
        const sign = tx.type === 'sell' ? '+' : '-';
        const txAmount = tx.amount ?? 0;
        const icon = tx.type === 'sell'
          ? <TrendingUp className="h-4 w-4" />
          : tx.type === 'renew'
            ? <RefreshCw className="h-4 w-4" />
            : <Plus className="h-4 w-4" />;
        const iconBg = tx.type === 'sell'
          ? 'bg-emerald-50 text-emerald-600'
          : tx.type === 'renew'
            ? 'bg-amber-50 text-amber-600'
            : 'bg-teal-50 text-teal-600';
        return {
          icon,
          iconBg,
          title: t('dashboard.briefingActivityTitle'),
          primary: t('dashboard.briefingActivityPrimary')
            .replace('{type}', t(`transaction.${tx.type}`))
            .replace('{amount}', sign + formatCurrency(txAmount))
            .replace('{domain}', dom?.domain_name ?? t('common.unknownDomain')),
          secondary: formatTransactionDate(tx.date),
          action: {
            label: t('dashboard.briefingViewActivity'),
            onClick: onViewActivity,
          },
        };
      })()
    : {
        icon: <FileText className="h-4 w-4" />,
        iconBg: 'bg-stone-100 text-stone-500',
        title: t('dashboard.briefingActivityTitle'),
        primary: t('dashboard.briefingActivityNone'),
        secondary: t('dashboard.briefingActivityNoneHint'),
        empty: true,
      };

  const stuckCard: BriefingCard = stuckDomains.length > 0
    ? {
        icon: <Award className="h-4 w-4" />,
        iconBg: 'bg-amber-50 text-amber-600',
        title: t('dashboard.briefingStuckTitle'),
        primary: t('dashboard.briefingStuckPrimary').replace('{count}', String(stuckDomains.length)),
        secondary: t('dashboard.briefingStuckSecondary'),
        action: {
          label: t('dashboard.briefingReview'),
          onClick: () => {
            document
              .getElementById(domainListAnchorId)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          },
        },
      }
    : {
        icon: <Award className="h-4 w-4" />,
        iconBg: 'bg-stone-100 text-stone-500',
        title: t('dashboard.briefingStuckTitle'),
        primary: t('dashboard.briefingStuckNone'),
        empty: true,
      };

  return [expiringCard, activityCard, stuckCard];
}
