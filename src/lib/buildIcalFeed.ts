/**
 * Pure builder for the renewal calendar (iCalendar / RFC 5545) feed
 * served at /api/ical/[token]. No I/O, no env access — takes domains
 * + a "now" clock and returns the .ics string.
 *
 * Confidence-aware alarm strategy:
 *   - explicit / next_renewal_date → 30/14/7/1-day alarms (high confidence)
 *   - estimated                    → 14/3-day alarms only (lower confidence)
 *   - stale (already past + active) → no alarms, SUMMARY tagged "[needs review]"
 *   - unknown                      → not emitted at all
 *
 * Also: real-world calendar clients fold long lines at 75 octets per
 * RFC 5545 §3.1 and want CRLF line endings. We honour both.
 */

import { getEffectiveExpiry } from './effectiveExpiry';

export interface IcalDomain {
  id: string;
  domain_name: string;
  registrar?: string | null;
  status?: string | null;
  expiry_date?: string | null;
  next_renewal_date?: string | null;
  purchase_date?: string | null;
  renewal_cycle?: number | null;
  renewal_count?: number | null;
}

export interface BuildIcalFeedOptions {
  domains: IcalDomain[];
  /** "now" for the DTSTAMP line; defaulted to new Date() but injectable for tests. */
  now?: Date;
  /** Origin of the calendar (used in PRODID / X-WR-CALNAME). */
  productName?: string;
  /** Days past expiry beyond which an active/for_sale domain is considered stale. */
  staleGraceDays?: number;
}

const STALE_GRACE_DAYS_DEFAULT = 14;

/** Format a Date as YYYYMMDD in UTC (for VALUE=DATE all-day events). */
function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Format a Date as YYYYMMDDTHHMMSSZ (for DTSTAMP). */
function formatTimestamp(d: Date): string {
  return `${formatDateOnly(d)}T${
    d.getUTCHours().toString().padStart(2, '0')
  }${
    d.getUTCMinutes().toString().padStart(2, '0')
  }${
    d.getUTCSeconds().toString().padStart(2, '0')
  }Z`;
}

/** Add `days` calendar days to a UTC date (returns a new Date). */
function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * Escape a string for use as an iCalendar TEXT value (SUMMARY, DESCRIPTION).
 * RFC 5545 §3.3.11: backslash, comma, semicolon, newline.
 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Fold a single content line to ≤ 75 octets per RFC 5545 §3.1, joining
 * subsequent lines with CRLF + a single space. Operates on bytes so that
 * non-ASCII (CJK domain names, accented registrar names) can't push a
 * line over the limit by character count.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf-8');
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    // First chunk is 75 bytes; continuation lines start with one leading
    // space, leaving 74 bytes of payload room. Don't split mid-multibyte:
    // walk back until the byte we'd cut at is a valid utf-8 boundary.
    const limit = chunks.length === 0 ? 75 : 74;
    let end = Math.min(i + limit, bytes.length);
    while (end > i && (bytes[end] & 0xc0) === 0x80) end--;
    chunks.push(bytes.slice(i, end).toString('utf-8'));
    i = end;
  }
  return chunks.map((c, idx) => (idx === 0 ? c : ` ${c}`)).join('\r\n');
}

function joinLines(lines: string[]): string {
  return lines.map(foldLine).join('\r\n');
}

interface DomainEvent {
  uid: string;
  date: Date;
  summary: string;
  description: string;
  alarmTriggers: string[]; // e.g. ['-P30D', '-P14D']
}

function planDomainEvent(
  domain: IcalDomain,
  now: Date,
  staleGraceDays: number,
): DomainEvent | null {
  const eff = getEffectiveExpiry(domain);
  if (!eff.date) return null; // 'unknown' → skip

  const daysUntil = Math.ceil((eff.date.getTime() - now.getTime()) / 86_400_000);

  let summary: string;
  let alarmTriggers: string[];

  const isActiveOrListed = domain.status === 'active' || domain.status === 'for_sale';
  if (isActiveOrListed && daysUntil < -staleGraceDays) {
    // stale: probably renewed-but-not-recorded OR expired-but-not-marked
    summary = `[Needs review] Renew ${domain.domain_name}`;
    alarmTriggers = []; // don't fire alarms for an outdated date
  } else if (eff.source === 'estimated') {
    summary = `Renew ${domain.domain_name} (estimated)`;
    alarmTriggers = ['-P14D', '-P3D'];
  } else {
    summary = `Renew ${domain.domain_name}`;
    alarmTriggers = ['-P30D', '-P14D', '-P7D', '-P1D'];
  }

  const descParts = [
    `Domain: ${domain.domain_name}`,
    domain.registrar ? `Registrar: ${domain.registrar}` : null,
    `Source: ${eff.source}`,
    `Status: ${domain.status ?? 'unknown'}`,
  ].filter(Boolean) as string[];

  return {
    uid: `domain-${domain.id}@domain.financial`,
    date: eff.date,
    summary,
    description: descParts.join(' / '),
    alarmTriggers,
  };
}

function renderEvent(ev: DomainEvent, now: Date): string[] {
  const start = formatDateOnly(ev.date);
  const end = formatDateOnly(addDays(ev.date, 1));

  const out: string[] = [
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${formatTimestamp(now)}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeText(ev.summary)}`,
    `DESCRIPTION:${escapeText(ev.description)}`,
    'TRANSP:TRANSPARENT',
  ];

  for (const trigger of ev.alarmTriggers) {
    out.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(ev.summary)}`,
      `TRIGGER:${trigger}`,
      'END:VALARM',
    );
  }

  out.push('END:VEVENT');
  return out;
}

export function buildIcalFeed(opts: BuildIcalFeedOptions): string {
  const now = opts.now ?? new Date();
  const productName = opts.productName ?? 'Domain.Financial';
  const staleGraceDays = opts.staleGraceDays ?? STALE_GRACE_DAYS_DEFAULT;

  const events = opts.domains
    .filter((d) => d.status !== 'sold' && d.status !== 'expired')
    .map((d) => planDomainEvent(d, now, staleGraceDays))
    .filter((e): e is DomainEvent => e !== null);

  const calendar: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${productName}//Renewal Calendar//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`${productName} Renewals`)}`,
    `X-WR-CALDESC:${escapeText('Upcoming domain renewals')}`,
    'X-WR-TIMEZONE:UTC',
    // Hint to clients to refresh every 12h. Not all clients honour it,
    // but Apple Calendar and outlook.com do.
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ];

  for (const ev of events) {
    calendar.push(...renderEvent(ev, now));
  }

  calendar.push('END:VCALENDAR');
  // RFC 5545 wants CRLF and a trailing CRLF.
  return joinLines(calendar) + '\r\n';
}
