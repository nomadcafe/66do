-- Add registration_date — the date a domain was first created at its
-- registrar — as a separate field from purchase_date.
--
-- Why a separate column:
--   purchase_date in our schema means "when THIS user acquired the
--   domain", which for aftermarket / drop-catch / inbound-transfer
--   purchases differs significantly from the registrar's original
--   registration date. Conflating them (an early version of the CSV
--   import did this) corrupts ROI, holding-period, and time-series
--   chart math for users who buy on Sedo / Afternic / Atom / Dan etc.
--
-- Properties:
--   - date NULL: no value before this migration runs; back-filled
--     opportunistically when users re-import their CSV (GoDaddy /
--     Dynadot / Spaceship / Name.com all carry the field) or fill it
--     manually in the edit form.
--   - No default — null is meaningful ("we don't know yet"). Code
--     that reads this field must handle null and not silently fall
--     back to purchase_date or today.
--
-- Run order:
--   This migration is independent — drop it into the Supabase SQL
--   editor and run, no dependencies on other pending migrations.
--   Existing rows are not touched (no values written), so this is
--   safe to run on a live database with traffic.

ALTER TABLE public.domains
  ADD COLUMN IF NOT EXISTS registration_date date;

COMMENT ON COLUMN public.domains.registration_date IS
  'Date the domain was first created at the registrar. Distinct from purchase_date (which is when this user acquired the domain). Nullable — populated lazily via CSV import or manual edit.';
