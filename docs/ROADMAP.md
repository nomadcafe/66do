# Roadmap

Living document. Add items at the bottom of the appropriate section as they come up; archive done items into a dated bullet under **Recently shipped**. Keep entries one or two lines each — link out for design rationale.

Last updated: 2026-04-30 (added Product & growth section)

---

## Now (operational, do before the next deploy)

- [ ] Run `database/add_auth_events.sql` against Supabase prod. Until this lands, every successful sign-in / data export silently fails the audit insert (caught + logged, no user impact, but the Recent Activity panel stays empty).

---

## Next (small wireups — 1 line each, code already in place)

- [ ] **Change sign-in email** UI in Settings → Account. When wired, call `fireSensitiveOpNotification(session, 'email_change')`. Endpoint scaffold + activity-panel icon + i18n strings already exist.
- [ ] **Delete account** UI + cascade. Same pattern: `fireSensitiveOpNotification(session, 'account_delete')`. Need to also clean up `domains`, `domain_transactions`, `auth_events`, `users` rows. Supabase `auth.users` cascade + ON DELETE CASCADE on FKs covers most of it.
- [ ] **Unlink Google OAuth** in Settings. `fireSensitiveOpNotification(session, 'oauth_unbind')`.
- [ ] **Auth events retention job**: cron / pg_cron to delete `auth_events` rows older than ~12 months. Table is append-only by design but unbounded growth isn't desirable.

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

- [ ] **Connect a registrar account, auto-import portfolio + renewals**. The single highest-impact feature missing. Manually entering 100+ domains is the #1 reason serious investors stay on spreadsheets. Start with one provider — **Namecheap** (API-friendly, popular with domainers) or **Dynadot** (favoured by serious investors). One integration is enough to validate; expand to GoDaddy / Sav / Porkbun later. Expected impact: 5–10× signup→active conversion.

### 2. Bookkeeping → Advisor (positioning shift)

- [ ] **Comparable sales / fair-value signals**. Integrate NameBio (300k+ recorded sales/month) so each domain shows "median comparable sale: $X over last 12 months." Turns the product from "passive ledger" into "advisor that has an opinion." This is what would let us compete with Estibot.
- [ ] **Forward-looking action recommendations**. Today's Insights are retrospective ("you sold X for Y profit"). Add prospective:
  - "These 3 domains held >5 yrs with no inquiries — drop on next renewal? ($XXX saved)"
  - "Renewal in 14d on $12 domain; portfolio avg sale $1,200 → renewal economics OK"
  - Optional weekly digest email.

### 3. Sale workflow closure

- [ ] **For-sale landing page generator**. One-click "publish a 'this domain is for sale' page" with contact form → leads land in dashboard. Removes the "I marked it for sale, now what?" gap.
- [ ] **Marketplace listing sync** to Sedo / Afternic / Dan.com (their APIs are open). User pushes from Domain.Financial; sale records flow back automatically.
- [ ] **Inquiry tracking**: forward email inquiries into the dashboard, attach to the relevant domain.

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

---

## Recently shipped

- 2026-04-30 — In-app activity log replacing email alerts (`956038d`)
- 2026-04-30 — Privacy / Terms / Cookies pages aligned to redesigned palette (`fa98a89`); honesty pass on Privacy claims (`5764c03`, `ef2c07c`, `ac2b615`, `b671822`, `71cc3b8`, `fcd060b`)
- 2026-04-30 — SEO: OG / Twitter image, viewport export, JSON-LD on homepage (`55cdc99`)
- 2026-04-30 — Insights restructure (Performance / Portfolio split, Success rate, hero KPI overhaul)
- 2026-04-29 — Full visual rewrite (login / 404 / landing / forms / cards aligned to stone + teal/emerald palette)
