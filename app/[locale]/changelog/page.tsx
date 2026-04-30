import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Sparkles, Calendar } from 'lucide-react';
import { type HomeLocale } from '../../../src/i18n/homeDictionary';
import { isHomeLocale } from '../../../src/i18n/localePath';
import {
  changelogPageCopy,
  changelogPageMetadata,
  changelogReleases,
} from '../../../src/content/changelog';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: l } = await params;
  if (!isHomeLocale(l)) notFound();
  return changelogPageMetadata(l);
}

export default async function ChangelogPage({ params }: PageProps) {
  const { locale: l } = await params;
  if (!isHomeLocale(l)) notFound();
  const locale = l as HomeLocale;
  const copy = changelogPageCopy[locale];
  const releases = changelogReleases[locale];
  const latestDate = releases[0]?.date ?? null;
  const latestLabel = locale === 'zh' ? '最近更新' : 'Latest';

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-teal-50/40 via-stone-50 to-amber-50/30 text-stone-900 antialiased">
      {/* Decorative corner glows — same language as login / not-found / empty state */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-teal-200/30 via-emerald-100/20 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-amber-100/30 to-transparent blur-3xl"
      />

      <header className="relative border-b border-stone-200/80 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 transition hover:text-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded-md"
          >
            <ArrowLeft className="h-4 w-4" />
            {copy.backHome}
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center sm:text-left">
          {latestDate && (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/60 bg-teal-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
              <Sparkles className="h-3.5 w-3.5" />
              {latestLabel} · <time dateTime={latestDate} className="tabular-nums">{latestDate}</time>
            </p>
          )}
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-stone-600 sm:text-lg">
            {copy.subtitle}
          </p>
        </div>

        <ol className="mt-10 space-y-6 sm:mt-12 sm:space-y-8">
          {releases.map((release, idx) => (
            <li
              key={`${release.version}-${release.date}`}
              className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white/90 p-6 shadow-sm shadow-stone-900/[0.02] transition hover:shadow-md hover:shadow-stone-900/[0.04] sm:p-7"
            >
              {idx === 0 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br from-teal-100/40 to-transparent blur-2xl"
                />
              )}
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/70 pb-4">
                  <h2 className="text-lg font-semibold text-stone-900 tabular-nums sm:text-xl">
                    {release.version}
                  </h2>
                  <time
                    dateTime={release.date}
                    className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 tabular-nums"
                  >
                    <Calendar className="h-3 w-3" />
                    {release.date}
                  </time>
                </div>
                <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-stone-700">
                  {release.items.map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500"
                      />
                      <span className="flex-1">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
