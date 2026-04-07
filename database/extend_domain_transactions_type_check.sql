-- 与前端一致的交易类型：buy, renew, sell, transfer, fee, marketing, advertising
-- 在 Supabase：SQL Editor 中执行（若约束名不同，先查：）
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.domain_transactions'::regclass AND contype = 'c';

-- 若库里曾使用 purchase / renewal，先统一到应用用词（按需取消注释）
-- UPDATE public.domain_transactions SET type = 'buy' WHERE type = 'purchase';
-- UPDATE public.domain_transactions SET type = 'renew' WHERE type = 'renewal';

ALTER TABLE public.domain_transactions
  DROP CONSTRAINT IF EXISTS domain_transactions_type_check;

ALTER TABLE public.domain_transactions
  ADD CONSTRAINT domain_transactions_type_check
  CHECK (
    type IN (
      'buy',
      'renew',
      'sell',
      'transfer',
      'fee',
      'marketing',
      'advertising'
    )
  );
