-- Add Atom listing-tier commission fields to domain_transactions for the
-- Atom Installment platform fee calculation.
--
-- Background:
--   The previous calculateAtomInstallmentFee silently treated the seller's
--   base commission as 0% — only the surcharge 35/65 split was modeled,
--   which understated platform fees on every Atom installment row. Atom's
--   real seller commission depends on the listing tier:
--
--     standard : 7.5%
--     plus     : 15%
--     premium  : 30% (≤ $4,998; "no coin" → 35%)
--                25% ($4,999 – $49,999)
--                20% ($50,000 – $74,999)
--                15% (≥ $75,000)
--     byol     : 4.5% / 3.75% / 2.9% / 2.25% / 1.9% / 1.75% / 1.35%
--                (price-bracketed; ≤ $4,999 has a $25 minimum commission)
--     custom   : application-supplied rate (atom_custom_commission_rate)
--
-- All three columns are nullable; non-Atom rows leave them NULL. For Atom
-- rows the application layer defaults missing tier values to 'standard'
-- (7.5%), which is itself a correction over the previous "0% base" math.

ALTER TABLE public.domain_transactions
  ADD COLUMN IF NOT EXISTS atom_commission_tier        text,
  ADD COLUMN IF NOT EXISTS atom_no_coin                boolean,
  ADD COLUMN IF NOT EXISTS atom_custom_commission_rate numeric(6,4);
