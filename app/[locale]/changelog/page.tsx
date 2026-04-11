import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
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

  return (
    <div
      className="min-h-screen antialiased"
      style={{
        backgroundColor: 'var(--home-bg, #fafaf9)',
        color: 'var(--home-text, #1c1917)',
      }}
    >
      <header
        className="border-b"
        style={{
          borderColor: 'var(--home-border, #e7e5e4)',
          backgroundColor: 'var(--home-header-bg, rgba(250, 250, 249, 0.85))',
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href={`/${locale}`}
            className="text-sm font-medium text-teal-700 transition hover:text-teal-800"
          >
            ← {copy.backHome}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {copy.title}
        </h1>
        <p
          className="mt-3 text-lg"
          style={{ color: 'var(--home-text-muted, #57534e)' }}
        >
          {copy.subtitle}
        </p>

        <ol className="mt-12 space-y-12">
          {releases.map((release) => (
            <li key={`${release.version}-${release.date}`}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3" style={{ borderColor: 'var(--home-border, #e7e5e4)' }}>
                <h2 className="text-xl font-semibold">{release.version}</h2>
                <time
                  dateTime={release.date}
                  className="text-sm tabular-nums"
                  style={{ color: 'var(--home-text-muted, #57534e)' }}
                >
                  {release.date}
                </time>
              </div>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed" style={{ color: 'var(--home-text-muted, #44403c)' }}>
                {release.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
