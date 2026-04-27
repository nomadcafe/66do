-- Add a free-text "platform" / marketplace column to domain_transactions.
--
-- Background:
--   The Transaction TypeScript type already declared a `platform` field
--   and EnhancedFinancialReport groups platform-fee data by it (falling
--   back to 'Unknown'). But the column never existed in Supabase, the
--   transaction insert payload didn't serialize it, and the form had no
--   input — so reports were uniformly 'Unknown'. This wires the field
--   up end-to-end.
--
--   Free text on purpose (Afternic / Atom / Sedo / Dan / Escrow.com /
--   Spaceship / GoDaddy / Namecheap / NameSilo / etc.). The form
--   suggests common marketplaces via a datalist seeded list plus
--   anything previously typed.
--
-- Existing rows stay NULL → reports continue to bucket them as
-- 'Unknown' until the user back-fills.

ALTER TABLE public.domain_transactions
  ADD COLUMN IF NOT EXISTS platform text;
