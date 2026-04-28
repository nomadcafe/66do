'use client';

import { Globe, FileText, PieChart } from 'lucide-react';

export type DashboardTab = 'portfolio' | 'activity' | 'insights';

interface DashboardTabsNavProps {
  active: DashboardTab;
  onChange: (next: DashboardTab) => void;
  /** Number shown as a red badge on the Portfolio tab. 0 → no badge. */
  expiringCount: number;
  labels: {
    portfolio: string;
    activity: string;
    insights: string;
    /** Tooltip / aria-label explaining what the red Portfolio badge counts. */
    expiringBadgeTitle: string;
  };
}

/**
 * The three-tab strip (Portfolio / Activity / Insights) under the header.
 * Pulled out of dashboard/page.tsx as part of the second P0 trim. The
 * right-edge fade gradient that hints horizontal overflow on small
 * screens is part of this component since it's anchored to the strip.
 */
export default function DashboardTabsNav({
  active,
  onChange,
  expiringCount,
  labels,
}: DashboardTabsNavProps) {
  const tabClass = (tab: DashboardTab) =>
    `rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
      active === tab
        ? 'bg-stone-900 text-white shadow-sm'
        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
    }`;

  return (
    <div className="relative bg-white rounded-2xl border border-stone-200/80 shadow-sm mb-6 overflow-hidden">
      <nav
        className="flex gap-1 p-1.5 overflow-x-auto bg-stone-50/50 border-b border-stone-100"
        aria-label="Tabs"
      >
        <button onClick={() => onChange('portfolio')} className={tabClass('portfolio')}>
          <Globe className="h-4 w-4" />
          {labels.portfolio}
          {expiringCount > 0 && (
            <span
              title={labels.expiringBadgeTitle.replace('{count}', String(expiringCount))}
              aria-label={labels.expiringBadgeTitle.replace('{count}', String(expiringCount))}
              className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                active === 'portfolio' ? 'bg-red-400 text-white' : 'bg-red-500 text-white'
              }`}
            >
              {expiringCount}
            </span>
          )}
        </button>
        <button onClick={() => onChange('activity')} className={tabClass('activity')}>
          <FileText className="h-4 w-4" />
          {labels.activity}
        </button>
        <button onClick={() => onChange('insights')} className={tabClass('insights')}>
          <PieChart className="h-4 w-4" />
          {labels.insights}
        </button>
      </nav>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 bottom-px w-10 bg-gradient-to-l from-stone-50 via-stone-50/70 to-transparent lg:hidden"
      />
    </div>
  );
}
