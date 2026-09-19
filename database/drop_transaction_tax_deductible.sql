-- Remove the domain_transactions.tax_deductible column.
--
-- Background:
--   The "Tax Deductible" checkbox on Add/Edit Transaction was write-only:
--   the form wrote it, the API stored it, the edit form read it back, and
--   nothing else in the app ever looked at it. No report, no filter, no
--   search, no export column.
--
--   It was also the weakest of the four free-form fields we audited
--   (category / platform / receipt_url / tax_deductible), for reasons the
--   others didn't share:
--
--     - The checkbox rendered on every transaction type, including `sell`,
--       where "tax deductible" is meaningless — a sale is income.
--     - It defaulted to false, and useDomainOperations hard-coded false on
--       auto-generated renewal / transfer rows. For a domain investor those
--       are ordinary deductible business expenses, so the stored value was
--       wrong-by-default on the majority of rows. Any total built on it
--       would have read near-zero and misled rather than helped.
--     - Deductibility depends on jurisdiction and on capitalise-vs-expense
--       treatment. The app cannot validate any of that, and its own Terms
--       explicitly state it does not provide tax advice. A boolean the user
--       ticks by hand is a note-to-self, not a computation.
--
--   What a user actually needs at tax time — "what did I spend this year,
--   on what, and where are the receipts" — the app derives from `type`
--   without any manual flagging (YearlyCashflowTable, plus the receipt
--   links added in 299ab38). The boolean added nothing on top.
--
-- What's removed:
--   - public.domain_transactions.tax_deductible (boolean)
--
--   The values are not recoverable after this runs. They were user-entered,
--   so export a backup first if there is any chance someone relied on them:
--     SELECT id, date, type, amount, tax_deductible
--       FROM public.domain_transactions
--      WHERE tax_deductible IS TRUE;
--
-- APPLIED: 2026-09-19. Recorded in schema_migrations the same day.
--
--   The ordering below is what *should* have happened. What actually happened
--   is that the code deploy went out first (this repo auto-deploys on push to
--   main via the Vercel Git integration), and step 2 ran afterwards. The end
--   state is identical, but there was a window where transaction inserts would
--   have failed had the column been NOT NULL without a default.
--
--   It turned out to be harmless — `SELECT COUNT(*) FILTER (WHERE
--   tax_deductible IS TRUE)` came back 0 out of 102 transactions, confirming
--   the flag had never once been used in the app's entire history.
--
--   Keep the ordering below for the next column removal; the point of writing
--   it down is that push == deploy here, so "before the deploy" means "before
--   you push", not "before you remember to".
--
-- ORDERING — read this before running anything:
--
--   Step 1 and step 2 run BEFORE the code deploy. Step 3 runs AFTER.
--
--   The reason is that the new code no longer sends tax_deductible in its
--   INSERT payload. If the column is NOT NULL without a default, that
--   deploy would start failing every transaction insert. Step 2 gives it a
--   default so the column tolerates being omitted, which makes the deploy
--   safe no matter how the column is currently defined. It is a harmless
--   no-op if a default already exists.
--
--   Dropping the column before the deploy would break the *old* code the
--   same way (it still sends the field), so the drop has to come last.

-- ============================================================
-- 步骤 1：先看这一列现在是怎么定义的（只读，确认后再往下）
-- ============================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'domain_transactions'
  AND column_name = 'tax_deductible';

-- 顺带看看有多少行真的被勾过——如果是 0，说明这个字段从来没被用过，
-- 删除没有任何信息损失。
SELECT
  COUNT(*) FILTER (WHERE tax_deductible IS TRUE)  AS ticked,
  COUNT(*) FILTER (WHERE tax_deductible IS FALSE) AS unticked,
  COUNT(*) FILTER (WHERE tax_deductible IS NULL)  AS null_rows,
  COUNT(*)                                        AS total
FROM public.domain_transactions;

-- ============================================================
-- 步骤 2：部署新代码**之前**跑。让这一列可以被省略。
-- ============================================================
ALTER TABLE public.domain_transactions
  ALTER COLUMN tax_deductible SET DEFAULT false;

-- ============================================================
-- 步骤 3：新代码部署完、确认交易增删改都正常之后再跑。
-- ============================================================
ALTER TABLE public.domain_transactions
  DROP COLUMN IF EXISTS tax_deductible;

-- ============================================================
-- 步骤 4：核对——应该返回 0 行
-- ============================================================
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'domain_transactions'
  AND column_name = 'tax_deductible';

INSERT INTO public.schema_migrations (filename, notes)
VALUES (
  'drop_transaction_tax_deductible.sql',
  'Drops the write-only tax_deductible flag; nothing in the app ever read it.'
)
ON CONFLICT (filename) DO NOTHING;
