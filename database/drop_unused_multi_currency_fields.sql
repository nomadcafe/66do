-- Drop the exchange_rate / base_amount columns that were added for a
-- multi-currency feature that never shipped. The application is USD-only;
-- every existing row stores exchange_rate=1 and base_amount=amount, and
-- the app code stopped reading or writing them in commit 38fc472.
--
-- Order matters:
--   1. Replace the renew-trigger function so it no longer references
--      NEW.exchange_rate / NEW.base_amount on domain_transactions.
--   2. Drop the columns from renewal_cost_history (the trigger fed it).
--   3. Drop the columns from domain_transactions.
--
-- Run this in Supabase SQL editor when ready. Destructive but safe:
-- the data carried by these columns is fully reproducible from `amount`.

-- 1. Update the renew-trigger to stop referencing the doomed columns.
CREATE OR REPLACE FUNCTION record_renewal_cost_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'renew' THEN
    INSERT INTO renewal_cost_history (
      domain_id,
      renewal_date,
      renewal_cost,
      currency,
      renewal_cycle,
      registrar,
      notes
    ) VALUES (
      NEW.domain_id,
      NEW.date::DATE,
      NEW.amount,
      NEW.currency,
      (SELECT renewal_cycle FROM domains WHERE id = NEW.domain_id),
      NEW.category,
      NEW.notes
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop columns from renewal_cost_history.
ALTER TABLE public.renewal_cost_history DROP COLUMN IF EXISTS exchange_rate;
ALTER TABLE public.renewal_cost_history DROP COLUMN IF EXISTS base_amount;

-- 3. Drop columns from domain_transactions.
ALTER TABLE public.domain_transactions  DROP COLUMN IF EXISTS exchange_rate;
ALTER TABLE public.domain_transactions  DROP COLUMN IF EXISTS base_amount;
