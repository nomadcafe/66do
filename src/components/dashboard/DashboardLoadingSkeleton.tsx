'use client';

/**
 * Dashboard loading-state placeholder. Pulled out of dashboard/page.tsx
 * to keep the page component focused on real layout. No props — the
 * skeleton is static and just mirrors the post-load layout's shapes.
 */
export default function DashboardLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="border-b border-stone-200/60 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-200 rounded-xl animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 bg-stone-200 rounded animate-pulse" />
              <div className="h-3 w-20 bg-stone-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 h-9 bg-stone-200 rounded-xl animate-pulse hidden sm:block" />
            <div className="w-32 h-10 bg-stone-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-stone-200 rounded animate-pulse" />
                  <div className="h-7 w-20 bg-stone-200 rounded animate-pulse" />
                  <div className="h-3 w-28 bg-stone-100 rounded animate-pulse" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-stone-100 animate-pulse shrink-0" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/80 mb-6 p-1.5 shadow-sm">
          <div className="h-9 bg-stone-100 rounded-lg animate-pulse" />
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm grid grid-cols-2 sm:grid-cols-4 divide-stone-100 sm:divide-x divide-y sm:divide-y-0 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="h-3 w-20 bg-stone-200 rounded animate-pulse" />
              <div className="h-5 w-16 bg-stone-200 rounded animate-pulse" />
              <div className="h-3 w-28 bg-stone-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
