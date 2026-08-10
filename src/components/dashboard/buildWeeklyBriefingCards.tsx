import { AlertTriangle, Award, Calendar, DollarSign, FileText, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import type { BriefingCard } from './WeeklyBriefing';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import type { ActiveInstallmentSummary } from '../../lib/installmentDue';

interface BuildWeeklyBriefingCardsInput {
  expiringThisWeek: DomainWithTags[];
  expiringThisWeekCost: number;
  recentTransactions: TransactionWithRequiredFields[];
  stuckDomains: DomainWithTags[];
  domains: DomainWithTags[];
  /** 本周（含轻微逾期）应收的分期，按最早到期排序。 */
  receiptsDueThisWeek: ActiveInstallmentSummary[];
  t: (key: string) => string;
  formatCurrency: (n: number) => string;
  formatTransactionDate: (date: string) => string;
  onRenew: (domain: DomainWithTags) => void;
  onViewActivity: () => void;
  /** Open the domain detail/edit drawer for a single domain — used by the
   *  stuck card when there's only one stuck domain so Review lands directly
   *  on the item instead of dumping the user at the list anchor. */
  onViewDomain: (domain: DomainWithTags) => void;
  /** Multi-stuck path: switch DomainList into ?dmstuck=1 mode + scroll. The
   *  page owns the URL/scroll mechanics so this builder stays presentational. */
  onReviewStuck: () => void;
  /** Same idea for the "Expiring soon" multi case — sets ?dmexpiring=1 and
   *  scrolls to the domain list. */
  onReviewExpiring: () => void;
  /** Multi receipts-due path — switches to the activity tab AND sets
   *  ?txdue=1 in one shot so the list is already filtered when the user
   *  lands there, instead of scrolling to the domain list (wrong page). */
  onReviewReceiptsDue: () => void;
  /** 点 "+ 收款" 时弹 ReceiptsModal —— 复用 dashboard 已有的状态。 */
  onOpenReceipts: (transaction: TransactionWithRequiredFields) => void;
}

/**
 * Builds the four-card payload for the WeeklyBriefing component on the
 * Portfolio tab. Pulled out of dashboard/page.tsx where it had grown to
 * an 80-line inline array literal — too dense to read or modify safely.
 *
 * Each card has a "live" branch (something to do) and a calm "empty"
 * branch (you're good). Order is intentional: expiry → receipts → activity → stuck
 * (see the trailing comment on the return for the rationale — receipts sit
 * second because they're also time-sensitive "this week" work).
 */
export function buildWeeklyBriefingCards({
  expiringThisWeek,
  expiringThisWeekCost,
  recentTransactions,
  stuckDomains,
  domains,
  receiptsDueThisWeek,
  t,
  formatCurrency,
  formatTransactionDate,
  onRenew,
  onViewActivity,
  onViewDomain,
  onReviewStuck,
  onReviewExpiring,
  onReviewReceiptsDue,
  onOpenReceipts,
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
        // Multiple → "Review" sets ?dmexpiring=1 so the list narrows to just
        // those domains (matches the stuck card's pattern). We never auto-
        // pick "the first" because the user needs to choose which to renew.
        action: expiringThisWeek.length === 1
          ? {
              label: t('common.renew'),
              onClick: () => onRenew(expiringThisWeek[0]),
            }
          : {
              label: t('dashboard.briefingReview'),
              onClick: onReviewExpiring,
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

  // 本周应收分期：跟 expiringCard 一个套路 — 一笔时直接 "+ 收款"，多笔时
  // 给数量 + 滚动去 list / activity tab 让用户挑。
  const receiptsCard: BriefingCard = receiptsDueThisWeek.length > 0
    ? (() => {
        const top = receiptsDueThisWeek[0];
        const expectedAmount = top.transaction.installment_amount ?? 0;
        const dueLabel = top.nextDue ? formatTransactionDate(top.nextDue.toISOString().slice(0, 10)) : '';
        const primary = receiptsDueThisWeek.length === 1
          ? t('dashboard.briefingReceiptsDuePrimaryOne')
              .replace('{domain}', top.domain.domain_name)
              .replace('{paid}', String(top.paid + 1))
              .replace('{total}', String(top.total))
          : t('dashboard.briefingReceiptsDuePrimaryMany')
              .replace('{count}', String(receiptsDueThisWeek.length));
        const secondary = receiptsDueThisWeek.length === 1 && expectedAmount > 0
          ? t('dashboard.briefingReceiptsDueSecondary')
              .replace('{amount}', formatCurrency(expectedAmount))
              .replace('{date}', dueLabel)
          : dueLabel
            ? t('dashboard.briefingReceiptsDueSecondaryNearest').replace('{date}', dueLabel)
            : undefined;
        return {
          icon: <DollarSign className="h-4 w-4" />,
          iconBg: 'bg-emerald-50 text-emerald-600',
          title: t('dashboard.briefingReceiptsDueTitle'),
          primary,
          secondary,
          // Single due → straight to the receipts modal for that tx.
          // Multiple → flip the activity tab into ?txdue=1 (so the page
          // owns tab switch + URL filter + scroll). Previously this scrolled
          // to the domain list, which was the wrong destination since
          // installments live on the activity tab.
          action: receiptsDueThisWeek.length === 1
            ? {
                label: t('transaction.addReceipt'),
                onClick: () => onOpenReceipts(top.transaction),
              }
            : {
                label: t('dashboard.briefingReview'),
                onClick: onReviewReceiptsDue,
              },
        };
      })()
    : {
        icon: <DollarSign className="h-4 w-4" />,
        iconBg: 'bg-stone-100 text-stone-500',
        title: t('dashboard.briefingReceiptsDueTitle'),
        primary: t('dashboard.briefingReceiptsDueNone'),
        empty: true,
      };

  const stuckCard: BriefingCard = stuckDomains.length > 0
    ? {
        icon: <Award className="h-4 w-4" />,
        iconBg: 'bg-amber-50 text-amber-600',
        title: t('dashboard.briefingStuckTitle'),
        // One stuck domain → name it; matches the expiring card's pattern so
        // Review goes straight to the only item we could have meant.
        primary: stuckDomains.length === 1
          ? stuckDomains[0].domain_name
          : t('dashboard.briefingStuckPrimary').replace('{count}', String(stuckDomains.length)),
        secondary: t('dashboard.briefingStuckSecondary'),
        // Single stuck → open that domain's detail directly. Multiple → flip
        // DomainList into the dmstuck filter so the user only sees the ones
        // the card is talking about, instead of scrolling into the full list.
        action: stuckDomains.length === 1
          ? {
              label: t('dashboard.briefingReview'),
              onClick: () => onViewDomain(stuckDomains[0]),
            }
          : {
              label: t('dashboard.briefingReview'),
              onClick: onReviewStuck,
            },
      }
    : {
        icon: <Award className="h-4 w-4" />,
        iconBg: 'bg-stone-100 text-stone-500',
        title: t('dashboard.briefingStuckTitle'),
        primary: t('dashboard.briefingStuckNone'),
        empty: true,
      };

  // 顺序：到期续费 → 本周应收 → 最近活动 → 卡住域名。
  // 把"应收"放第二，是因为这两件事都属于"本周该做"，时间敏感；活动卡是
  // 回顾性的，stuck 是长期信号。empty 状态用 stone-50 灰底降权重。
  return [expiringCard, receiptsCard, activityCard, stuckCard];
}
