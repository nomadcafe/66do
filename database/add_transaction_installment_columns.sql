-- Add installment and platform-fee fields to domain_transactions (Supabase).
-- Run in Supabase SQL Editor if your table does not have these columns yet.

ALTER TABLE domain_transactions
  ADD COLUMN IF NOT EXISTS payment_plan TEXT DEFAULT 'lump_sum',
  ADD COLUMN IF NOT EXISTS installment_period INTEGER,
  ADD COLUMN IF NOT EXISTS downpayment_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS installment_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS final_payment_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS total_installment_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS paid_periods INTEGER,
  ADD COLUMN IF NOT EXISTS installment_status TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee_type TEXT,
  ADD COLUMN IF NOT EXISTS user_input_fee_rate DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS user_input_surcharge_rate DECIMAL(5,4);
