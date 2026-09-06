# Roadmap

Living document. Add items at the bottom of the appropriate section as they come up; archive done items into a dated bullet under **Recently shipped**. Keep entries one or two lines each — link out for design rationale.

Last updated: 2026-05-23 (delete-account UI + cascade endpoint shipped)

---

## Now (operational, do before the next deploy)

_(empty)_

---

## Next (small wireups — 1 line each, code already in place)

- [ ] **Change sign-in email** UI in Settings → Account. When wired, call `fireSensitiveOpNotification(session, 'email_change')`. Endpoint scaffold + activity-panel icon + i18n strings already exist.
- [x] ~~**Delete account** UI + cascade.~~ Shipped 2026-05-23. Type-email-to-confirm panel in Settings → Security; `POST /api/auth/delete-account` records the audit event, deletes the `public.users` mirror, then `auth.admin.deleteUser` cascades to `domains` / `domain_transactions` / `auth_events` / `installment_receipts`.
- [ ] **Unlink Google OAuth** in Settings. `fireSensitiveOpNotification(session, 'oauth_unbind')`.
- [ ] **Auth events retention job**: cron / pg_cron to delete `auth_events` rows older than ~12 months. Table is append-only by design but unbounded growth isn't desirable.
- [ ] **Detect renewals from a CSV re-import.** Today `mergeCsvImportWithExisting` is fill-empty only: a re-import never touches a non-empty `expiry_date`, so a user who renewed at the registrar and re-exported sees nothing change. The naive fix (let CSV overwrite `expiry_date`) is **wrong and silently destructive**: `expandRenewalEvents` reconstructs historical archive renewals by walking backwards from the current expiry, so moving expiry forward a year without bumping `renewal_count` slides every past renewal forward a year — a 2020-bought domain with 3 renewals goes from 2021/2022/2023 to 2022/2023/2024, losing the 2021 spend and inventing a 2024 one. The correct reading of "CSV expiry is later than ours" is "N renewals happened in between", which means advancing `expiry_date` **and** `renewal_count` together, and confirming with the user first since it books renewal spending. Pinned by tests in `csvFormats.test.ts` so nobody flips fill-empty to overwrite by accident.

## Next — SEO

- [ ] Produce a proper **1200×630 OG hero image** (the current `domainfinancialpng.png` is 612×408 mascot, below FB / LinkedIn / Slack ideal). Replace `OG_IMAGE` references in `app/layout.tsx`, `homePageMetadata`, `changelogPageMetadata`, privacy / terms / cookies layouts.

---

## Later (bigger initiatives, design partly settled)

### Security UX deepening

- [ ] **Active sessions panel** with revoke buttons (GitHub-style). Requires a sessions table or wrapping Supabase's `auth.sessions` reads. More involved than the activity log; useful when an attacker has an active session you want to kick out without a full password reset.
- [ ] **New-region banner alert** in dashboard. When a sign-in's region differs from the user's last 30-day pattern, show a dismissible "Was this you?" banner. Cookie-based "device fingerprint" was rejected (false positives + privacy-hostile); region-based is honest about its limitations.

### Privacy posture upgrade ("operators can't see data")

Three layered options were discussed; deferred decision. Pick when the time is right:

- [ ] **Option C: server-side encryption + KMS** — encrypt sensitive columns (domain prices, sale prices) with a server-only key + per-user derived key, store ciphertext, decrypt on read. Single DB leak ≠ readable data. Cost: medium (new helpers + migration); trade-off: analytics still need server-side decrypt to compute, so we still need the key in memory at runtime.
- [ ] **Option B: full client-side E2EE** — encrypt in browser before insert with a key derived from user password / passphrase. True zero-knowledge: even we can't read it. Cost: high. Trade-offs:
  - Search / filter / aggregate must run client-side after decrypt (rewrite the entire analytics layer, including Insights / charts)
  - Forgotten passphrase = data lost forever (no recovery path)
  - Magic-link login wouldn't work (no password to derive a key from)
  - Best fit only if "privacy-first domain investing" becomes the explicit positioning of the product
- [ ] **Option A: stay as-is, keep policy honest** — what we currently do. RLS + Supabase at-rest + the in-app activity log + honest privacy policy. Most peer SaaS sit here. No work required; listed for completeness.

---

## Product & growth (PM lens, ranked by leverage)

These are feature-level bets, not infra follow-ups. Listed roughly in descending order of "would unlock adoption / pricing power."

### 1. Registrar sync — top adoption unlock

- [x] **Smart CSV import** — partial answer shipped 2026-05-02. Adapter layer at `src/lib/csvFormats/` recognises GoDaddy / Namecheap / Dynadot / Spaceship exports automatically; merge-by-name preserves user-filled fields; covers ~95% of "I have hundreds of domains, please don't make me type them" without storing any registrar credentials. Adding more registrars = one file each.
- [ ] **API-based auto-sync** (deferred). Re-importing a CSV does *not* refresh expiry dates today (see "Detect renewals from a CSV re-import" below); a real registrar API integration would close that loop with a daily cron. Pursue when a Pro user asks for it specifically — until then the security cost (encrypted credential store, IP-whitelist headaches with Namecheap) outweighs the marginal value over CSV. GoDaddy / Dynadot / Spaceship would be easiest first targets (no IP whitelist).

### 2. Bookkeeping → Advisor (positioning shift)

- [ ] **Comparable sales — free MVP (deep-link to NameBio)**. ~1 hour. Add a "Look up comparable sales →" button on each domain card that opens NameBio's public search pre-filled with the keyword + TLD. Zero cost, no API, gives the user 80% of the value (real sales data) without our paying anything. The trade-off is the user leaves our UI, but the positioning shift ("the product knows where to send you") is real.
- [x] **GoDaddy Appraisal — captured for free via CSV import** (shipped 2026-05-02). The CSV adapter pulls GoDaddy's `Estimated Value` column straight into our `estimated_value` field, so any user who imports their GoDaddy portfolio gets the appraisal number without us calling the API. The live `/v1/appraisal/{domain}` endpoint integration (to refresh appraisals on demand for non-GoDaddy domains) is deferred — the static snapshot from CSV satisfies the "visible valuation" goal for the dominant use case.
- [ ] **NameBio paid API integration** — defer until **50+ paying Pro subscribers**. The API runs ~$300/month; with Pro at $12/month, 25 subs is the break-even and 50 makes it comfortable. Until then the deep-link MVP carries the load. Implementation when triggered: ~6-8 hours (replace deep-link with inline median-sale display + filtering).
- [ ] **Forward-looking action recommendations**. Today's Insights are retrospective ("you sold X for Y profit"). Add prospective:
  - "These 3 domains held >5 yrs with no inquiries — drop on next renewal? ($XXX saved)"
  - "Renewal in 14d on $12 domain; portfolio avg sale $1,200 → renewal economics OK"
  - Optional weekly digest email.

### 3. Sale workflow closure

- [ ] **Public portfolio page** at `/u/<user>/portfolio` (opt-in). Lists the user's for-sale domains with an inquiry form, the user shares the URL on Twitter / NamePros / signature blocks. Inquiries flow into the dashboard. ~3-4h. Sidesteps the DNS-pointing friction of true per-domain landing pages.
- [ ] **For-sale landing page generator** (per-domain). One-click "publish a 'this domain is for sale' page" with contact form → leads land in dashboard. Removes the "I marked it for sale, now what?" gap. Caveat: requires the user to point DNS to us, which is real friction; competes with Bodis / ParkingCrew that pay PPC revenue. Defer until the public portfolio page validates demand.
- [ ] **Inquiry tracking**: capture inquiries from the public portfolio + per-domain landing pages, attach to the relevant domain. Built alongside the pages above.

### 4. Annual willingness-to-pay hooks

- [ ] **Tax export**. One button → CSV / PDF of cap gains for the calendar year, formatted for Schedule D (US) and parallel jurisdictions where feasible. Used once a year, but the user who's used it once will not churn before next April.

### 5. Retention / virality

- [ ] **Anonymous benchmarking**. "Your success rate ranks top 30% among investors with 50–100-domain portfolios" / ".ai sell-through is up 14% QoQ across the platform." Pure aggregates, no individual data exposed. Free, sticky, and screenshot-shareable on Twitter / NamePros.

### 6. Business model

- [ ] **Pricing tiers** to make the project sustainable:
  - **Free** — <20 domains, basic tracking
  - **Pro $12/mo** — unlimited domains, registrar sync, comparable sales, tax export, alerts
  - **Team $39/mo** — multi-user / shared portfolio (LLC partners, accountants)
- [ ] **Multi-user / read-only sharing** — required for the Team tier; many serious investors run their portfolio as an LLC with a partner or accountant.

---

## Considered, deferred

So we don't re-litigate these:

- **Resend / SMTP-based email security alerts**. Tried and reverted in `956038d`. The Recent Activity panel covers the same ground without an external dependency, and avoids the privacy-policy expansion that outgoing mail would have required.
- **Cookie-based "new device" detection emails**. Discussed; rejected. False positives on cookie clears / incognito + privacy-hostile fingerprinting + framing implies detection accuracy we can't deliver.
- **AES-256 / per-user encryption keys** as a marketing claim — was in the privacy translations, removed because the implementation didn't exist. Don't re-add without doing Option B or C first.
- **Sedo / Afternic / Dan.com API listing sync**. Looked into it: those APIs are gated behind partner-registrar agreements, not open to solo developers. Sedo's "Domains API" requires registrar partnership; Afternic requires Fast Transfer Network membership; Dan.com was absorbed into Afternic in 2022 (no standalone API). Revisit only when the product has registrar status or > a few thousand active users (i.e., negotiation leverage).

---

## Recently shipped

- 2026-05-23 — Delete account UI + cascade. New `POST /api/auth/delete-account` endpoint (Bearer-auth, write-rate-limited, service-role) records the `account_delete` audit row, deletes `public.users` mirror, then `auth.admin.deleteUser` to cascade `domains` / `domain_transactions` / `auth_events` / `installment_receipts`. New `AccountDangerZonePanel` mounts below Recent Activity in Settings → Security; type-the-email-to-confirm flow, signs out + redirects to `/` on success. zh/en strings added.
- 2026-05-03 — Fix auth_events silent-failure bug: client never called `fireSignInNotification` because Supabase SDK's `detectSessionInUrl` consumed the URL hash before the page handler ran, leaving the setSession/verifyOtp branches unreachable. Added the call to the early-return path in both `/auth/magic-link` and `/auth/callback`. Recent Activity panel now actually populates.
- 2026-05-03 — Data-storage audit: confirmed all date columns are `date` typed in prod (repo's old TEXT migration was superseded), all expected FKs exist with CASCADE, 0 orphan transaction rows. Added `database/_audit_schema_state.sql` to keep the audit queries reproducible.
- 2026-05-03 — `schema_migrations` tracker table added (`add_schema_migrations_tracker.sql`) so future migrations can record their own application — solves the "did this run yet?" question that bit `add_auth_events`, `add_ical_token`, `add_registration_date` in turn.
- 2026-05-03 — Dead-user cleanup: 782 → 225 in `public.users` + `auth.users` (557 unverified-30d-no-data accounts removed; ~35% of the deleted set were Gmail dot-trick bot signups). Funnel/conversion math is meaningful again.
- 2026-05-03 — Registration date split (`add_registration_date.sql` + `4d36901`): registrar's "Created / Registration Date / Create Date" CSV columns now write to a separate `registration_date` field instead of being conflated with `purchase_date` (which stayed wrong for aftermarket-bought domains).
- 2026-05-02 — Smart CSV import: GoDaddy / Namecheap / Dynadot / Spaceship adapters, merge-by-name preserves user-filled fields, GoDaddy Appraisal pulled into `estimated_value`, fixes pre-existing 409 dedup bug on bulk import (`9a977ae`, `60cbf47`, `bc9d8ac`)
- 2026-04-30 — In-app activity log replacing email alerts (`956038d`)
- 2026-04-30 — Privacy / Terms / Cookies pages aligned to redesigned palette (`fa98a89`); honesty pass on Privacy claims (`5764c03`, `ef2c07c`, `ac2b615`, `b671822`, `71cc3b8`, `fcd060b`)
- 2026-04-30 — SEO: OG / Twitter image, viewport export, JSON-LD on homepage (`55cdc99`)
- 2026-04-30 — Insights restructure (Performance / Portfolio split, Success rate, hero KPI overhaul)
- 2026-04-29 — Full visual rewrite (login / 404 / landing / forms / cards aligned to stone + teal/emerald palette)
