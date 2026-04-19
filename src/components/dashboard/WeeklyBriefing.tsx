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
 * Decision-driven briefing strip — replaces the static "highlights" cards.
 * Each card answers "what should I do this week?", with a clear next-step CTA.
 */
export default function WeeklyBriefing({ title, subtitle, cards }: WeeklyBriefingProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <div
            key={i}
            className={`flex flex-col rounded-2xl border p-5 transition ${
              card.empty
                ? 'border-stone-200/60 bg-stone-50/50'
                : 'border-stone-200/80 bg-white shadow-sm hover:shadow'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                {card.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{card.title}</p>
                <p className={`mt-1 text-base font-semibold leading-snug ${card.empty ? 'text-stone-500' : 'text-stone-900'}`}>
                  {card.primary}
                </p>
                {card.secondary && (
                  <p className="mt-1 text-xs text-stone-500">{card.secondary}</p>
                )}
              </div>
            </div>
            {card.action && (
              <div className="mt-4 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={card.action.onClick}
                  className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 rounded"
                >
                  {card.action.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
