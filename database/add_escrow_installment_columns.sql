-- Add Escrow.com Installment-specific columns to domain_transactions.
--
-- Background:
--   Escrow Installment is the only payment_fee_type whose calculator wasn't
--   actually wired up: calculateEscrowInstallmentFee accepted a domain
--   holding fee + escrow fee, but every call site passed undefined, so
--   platformFee always evaluated to 0 and the form had no UI to capture
--   either fee. After the fix the calculator structurally derives the
--   monthly holding fee per Escrow.com's published formula:
--
--     Lease with Purchase: max($100, listPrice × 0.0001) × period
--     Lease Only:          max($200, listPrice × 0.0002) × period
--
--   The "standard Escrow Fee" (transaction-fee table) and one-off events
--   ($250 schedule change, $85 DNS admin) remain manual — captured via
--   escrow_transaction_fee.
--
-- Columns:
--   escrow_lease_type      : 'lease_with_purchase' | 'lease_only'
--                            null on legacy rows → application-layer
--                            default 'lease_with_purchase'.
--   escrow_transaction_fee : flat USD figure for the manual portion.
--                            null on legacy rows → treated as 0.

ALTER TABLE public.domain_transactions
  ADD COLUMN IF NOT EXISTS escrow_lease_type      text,
  ADD COLUMN IF NOT EXISTS escrow_transaction_fee numeric;
