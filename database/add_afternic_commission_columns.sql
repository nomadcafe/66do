-- Add nameserver-pointed / premium-add-on flags to domain_transactions for
-- the Afternic Installment commission calculation.
--
-- Background:
--   The platform fee calculator (calculateAfternicInstallmentFee) was
--   previously hardcoding the standard Afternic commission at 15%. In
--   reality the rate ranges from 15% to 30% depending on two factors:
--     - Whether the seller's domain nameserver points to Afternic
--       (pointed = 15%, not pointed = 25%)
--     - Whether the optional Premium add-on is enabled (+5%)
--   Both flags are recorded per renew/sell transaction so that the fee
--   breakdown is reproducible from stored data.
--
-- Both columns are nullable; non-Afternic transactions leave them NULL.
-- For Afternic-installment rows the application layer defaults missing
-- values to (ns_pointed = true, premium_addon = false) — i.e. the
-- existing 15% baseline — preserving backward compatibility.

ALTER TABLE public.domain_transactions
  ADD COLUMN IF NOT EXISTS afternic_ns_pointed boolean,
  ADD COLUMN IF NOT EXISTS afternic_premium_addon boolean;
