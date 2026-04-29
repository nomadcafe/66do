'use client';

/**
 * Dashboard loading-state placeholder. Mirrors the actual post-load layout
 * shape (sticky header → tab nav → Hero card → Action Lane → status chips
 * → domain list) so the page doesn't visually re-flow when data arrives.
 *
 * No props — purely static. If the real layout shifts again, this needs
 * to follow.
 */
export default function DashboardLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* Header — logo on left, 2 action buttons + avatar pill on right */}
      <div className="border-b border-stone-200/60 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-200 rounded-xl animate-pulse" />
            <div className="h-5 w-36 bg-stone-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block w-28 h-10 bg-stone-200 rounded-xl animate-pulse" />
            <div className="w-32 h-10 bg-stone-200 rounded-xl animate-pulse" />
            <div className="w-14 h-10 bg-stone-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Tab nav strip */}
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-1.5">
          <div className="flex gap-1">
            <div className="h-9 w-28 bg-stone-200 rounded-lg animate-pulse" />
            <div className="h-9 w-24 bg-stone-100 rounded-lg animate-pulse" />
            <div className="h-9 w-24 bg-stone-100 rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Hero card — dual metric + sparkline + donut. Mirror of
            PortfolioHealthCard's actual layout: gradient bg, two big
            numbers side-by-side at md+, sparkline beneath, footer chips. */}
        <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-teal-50/50 via-white to-amber-50/40 shadow-md p-6 sm:p-8">
          <div className="grid gap-6 sm:gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_auto] lg:items-start">
            {/* Left: realized P&L */}
            <div className="space-y-2.5">
              <div className="h-3 w-24 bg-stone-200 rounded animate-pulse" />
              <div className="h-10 w-40 bg-stone-200 rounded animate-pulse" />
              <div className="h-3 w-32 bg-stone-100 rounded animate-pulse" />
            </div>
            {/* Middle: portfolio at cost */}
            <div className="space-y-2.5 md:border-l md:border-stone-200/70 md:pl-6">
              <div className="h-3 w-28 bg-stone-200 rounded animate-pulse" />
              <div className="h-9 w-36 bg-stone-200 rounded animate-pulse" />
              <div className="h-3 w-32 bg-stone-100 rounded animate-pulse" />
            </div>
            {/* Right: composition donut */}
            <div className="flex items-start gap-3 md:col-span-2 md:border-t md:border-stone-200/60 md:pt-4 lg:col-span-1 lg:border-t-0 lg:pt-0 lg:flex-col lg:items-end lg:gap-2">
              <div className="h-20 w-20 rounded-full bg-stone-200 animate-pulse" />
              <div className="space-y-1.5 flex-1 lg:flex-initial">
                <div className="h-2.5 w-20 bg-stone-200 rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-stone-100 rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-stone-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
          {/* Sparkline */}
          <div className="mt-7 h-16 bg-stone-100 rounded animate-pulse" />
          {/* Footer chips row */}
          <div className="mt-7 grid grid-cols-3 gap-3 border-t border-stone-200/70 pt-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-stone-100 animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-2.5 w-16 bg-stone-200 rounded animate-pulse" />
                  <div className="h-3.5 w-20 bg-stone-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Lane — 3 rows in one panel */}
        <div>
          <div className="mb-4 space-y-1.5">
            <div className="h-5 w-32 bg-stone-200 rounded animate-pulse" />
            <div className="h-3 w-56 bg-stone-100 rounded animate-pulse" />
          </div>
          <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-5 py-4 ${
                  i > 0 ? 'border-t border-stone-100' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-stone-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 w-24 bg-stone-200 rounded animate-pulse" />
                  <div className="h-3.5 w-48 bg-stone-100 rounded animate-pulse" />
                </div>
                <div className="w-16 h-7 bg-stone-200 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Status chip strip */}
        <div className="flex flex-wrap items-center gap-2">
          {[20, 16, 18, 14, 16].map((w, i) => (
            <div
              key={i}
              className="h-8 rounded-full bg-stone-200 animate-pulse"
              style={{ width: `${w * 4 + 24}px` }}
            />
          ))}
        </div>

        {/* Domain list (3 card placeholders) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-stone-200/80 border-l-4 border-l-stone-200 p-5 shadow-sm space-y-3"
            >
              <div className="flex items-start gap-3 pr-20">
                <div className="w-9 h-9 rounded-xl bg-stone-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 bg-stone-200 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-stone-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-2.5 w-24 bg-stone-200 rounded animate-pulse" />
                <div className="h-6 w-28 bg-stone-200 rounded animate-pulse" />
                <div className="h-3 w-44 bg-stone-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
