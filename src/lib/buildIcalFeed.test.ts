import { describe, it, expect } from 'vitest';
import { buildIcalFeed } from './buildIcalFeed';

const NOW = new Date('2026-04-28T12:00:00Z');

describe('buildIcalFeed', () => {
  it('emits a syntactically minimal feed when no domains given', () => {
    const ics = buildIcalFeed({ domains: [], now: NOW });
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('PRODID:-//Domain.Financial//Renewal Calendar//EN');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toMatch(/\r\n$/); // trailing CRLF
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('uses CRLF line endings throughout', () => {
    const ics = buildIcalFeed({ domains: [], now: NOW });
    // No bare LF should appear anywhere (every \n must be paired with \r).
    expect(ics.split('\n').slice(0, -1).every((l) => l.endsWith('\r'))).toBe(true);
  });

  it('emits a high-confidence event with 4 alarms for an explicit expiry_date', () => {
    const ics = buildIcalFeed({
      now: NOW,
      domains: [{
        id: 'd1',
        domain_name: 'example.com',
        registrar: 'GoDaddy',
        status: 'active',
        expiry_date: '2026-09-15',
      }],
    });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:domain-d1@domain.financial');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260915');
    expect(ics).toContain('DTEND;VALUE=DATE:20260916');
    expect(ics).toContain('SUMMARY:Renew example.com');
    expect((ics.match(/BEGIN:VALARM/g) ?? []).length).toBe(4);
    expect(ics).toContain('TRIGGER:-P30D');
    expect(ics).toContain('TRIGGER:-P14D');
    expect(ics).toContain('TRIGGER:-P7D');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).not.toContain('estimated');
  });

  it('marks estimated entries as such and emits only 2 alarms (14 / 3 days)', () => {
    const ics = buildIcalFeed({
      now: NOW,
      domains: [{
        id: 'd2',
        domain_name: 'no-explicit.com',
        status: 'active',
        purchase_date: '2025-04-28',
        renewal_count: 0,
        renewal_cycle: 1,
        // no expiry_date / next_renewal_date → estimated
      }],
    });
    expect(ics).toContain('SUMMARY:Renew no-explicit.com (estimated)');
    expect((ics.match(/BEGIN:VALARM/g) ?? []).length).toBe(2);
    expect(ics).toContain('TRIGGER:-P14D');
    expect(ics).toContain('TRIGGER:-P3D');
    expect(ics).not.toContain('TRIGGER:-P30D');
  });

  it('flags stale (active but >14d past expiry) without firing alarms', () => {
    const ics = buildIcalFeed({
      now: NOW, // 2026-04-28
      domains: [{
        id: 'd3',
        domain_name: 'lapsed.com',
        status: 'active',
        expiry_date: '2026-04-01', // 27 days past → > 14d grace
      }],
    });
    expect(ics).toContain('SUMMARY:[Needs review] Renew lapsed.com');
    expect(ics).not.toContain('BEGIN:VALARM');
  });

  it('respects a custom staleGraceDays threshold', () => {
    const ics = buildIcalFeed({
      now: NOW,
      staleGraceDays: 60,
      domains: [{
        id: 'd4',
        domain_name: 'slow-grace.com',
        status: 'active',
        expiry_date: '2026-04-01', // 27d past, but grace is 60 → not stale
      }],
    });
    expect(ics).not.toContain('[Needs review]');
    // High-confidence path → 4 alarms.
    expect((ics.match(/BEGIN:VALARM/g) ?? []).length).toBe(4);
  });

  it('skips domains with status sold or expired', () => {
    const ics = buildIcalFeed({
      now: NOW,
      domains: [
        { id: 'a', domain_name: 'sold.com', status: 'sold', expiry_date: '2027-01-01' },
        { id: 'b', domain_name: 'expired.com', status: 'expired', expiry_date: '2027-01-01' },
        { id: 'c', domain_name: 'active.com', status: 'active', expiry_date: '2027-01-01' },
      ],
    });
    expect(ics).not.toContain('sold.com');
    expect(ics).not.toContain('expired.com');
    expect(ics).toContain('Renew active.com');
  });

  it('skips a domain with no usable expiry data (unknown)', () => {
    const ics = buildIcalFeed({
      now: NOW,
      domains: [{ id: 'd5', domain_name: 'no-data.com', status: 'active' }],
    });
    expect(ics).not.toContain('no-data.com');
  });

  it('escapes commas / semicolons / newlines in SUMMARY/DESCRIPTION', () => {
    const ics = buildIcalFeed({
      now: NOW,
      domains: [{
        id: 'd6',
        domain_name: 'weird,name;with\nstuff.com',
        registrar: 'a, b; c',
        status: 'active',
        expiry_date: '2026-12-01',
      }],
    });
    // SUMMARY line should have escaped commas / semicolons / newlines.
    expect(ics).toContain('weird\\,name\\;with\\nstuff.com');
    expect(ics).toContain('a\\, b\\; c');
  });

  it('folds long content lines at 75 octets (RFC 5545 §3.1)', () => {
    const longName = 'x'.repeat(200) + '.com'; // forces folding
    const ics = buildIcalFeed({
      now: NOW,
      domains: [{
        id: 'd7',
        domain_name: longName,
        status: 'active',
        expiry_date: '2026-12-01',
      }],
    });
    // Continuation lines start with a single leading space.
    const lines = ics.split('\r\n');
    const summaryIdx = lines.findIndex((l) => l.startsWith('SUMMARY:'));
    expect(summaryIdx).toBeGreaterThan(-1);
    // The line right after SUMMARY: should start with a space (it's the
    // continuation), unless the SUMMARY happened to fit in 75 bytes.
    expect(lines[summaryIdx + 1].startsWith(' ')).toBe(true);
    // No content line (excluding folds, which start with space) should
    // exceed 75 octets after folding.
    for (const l of lines) {
      if (l.startsWith(' ')) continue;
      expect(Buffer.byteLength(l, 'utf-8')).toBeLessThanOrEqual(75);
    }
  });

  it('emits a stable DTSTAMP based on the injected `now`', () => {
    const ics = buildIcalFeed({
      now: NOW, // 2026-04-28T12:00:00Z
      domains: [{ id: 'd8', domain_name: 'a.com', status: 'active', expiry_date: '2027-01-01' }],
    });
    expect(ics).toContain('DTSTAMP:20260428T120000Z');
  });
});
