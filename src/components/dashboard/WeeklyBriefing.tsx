'use client';

import { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

export interface BriefingCard {
  icon: ReactNode;
  iconBg: string;
  title: string;
  primary: string;
  secondary?: string;
  action?: { label: string; onClick: () => void };
  empty?: boolean;
}

interface WeeklyBriefingProps {
  title: string;
  subtitle: string;
  cards: BriefingCard[];
}

/**
 * Compact horizontal action lane — replaces the previous 3-up card grid that
 * dominated above-the-fold space. Each item is now a single row inside one
 * bordered panel (alert-inbox aesthetic), so 3 items fit in roughly the
 * vertical footprint of one old card.
 *
 * On mobile each row stacks: icon + title block on top, action button below.
 * Desktop keeps the row layout horizontal with the action button right-aligned.
 */
export default function WeeklyBriefing({ title, subtitle, cards }: WeeklyBriefingProps) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
          <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
        {cards.map((card, i) => (
          <div
            key={i}
            className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 ${
              i > 0 ? 'border-t border-stone-100' : ''
            } ${card.empty ? 'bg-stone-50/40' : ''}`}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}
              >
                {card.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                  {card.title}
                </p>
                <p
                  className={`mt-0.5 truncate text-sm font-semibold leading-snug ${
                    card.empty ? 'text-stone-500' : 'text-stone-900'
                  }`}
                >
                  {card.primary}
                </p>
                {card.secondary && (
                  <p className="mt-0.5 truncate text-xs text-stone-500">{card.secondary}</p>
                )}
              </div>
            </div>
            {card.action && (
              <button
                type="button"
                onClick={card.action.onClick}
                className="shrink-0 self-start rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 sm:self-auto"
              >
                <span className="inline-flex items-center gap-1">
                  {card.action.label}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
