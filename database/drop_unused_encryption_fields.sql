-- Drop the *_encrypted columns and users.encryption_key that were added
-- by the (now-removed) add_encryption_fields.sql migration.
--
-- Context: these columns were added speculatively but no application
-- code ever wrote or read them. The accompanying encryption helpers
-- (src/lib/security.ts encryptData/decryptData) were deleted for being
-- dead code + an insecure CryptoJS.AES(string-key) pattern, so these
-- columns are guaranteed dormant storage debt.
--
-- Run this in Supabase SQL editor when ready. Destructive but safe:
-- zero rows have been written to any of these columns.

ALTER TABLE public.domains              DROP COLUMN IF EXISTS domain_name_encrypted;
ALTER TABLE public.domains              DROP COLUMN IF EXISTS registrar_encrypted;
ALTER TABLE public.domains              DROP COLUMN IF EXISTS purchase_date_encrypted;
ALTER TABLE public.domains              DROP COLUMN IF EXISTS expiry_date_encrypted;
ALTER TABLE public.domains              DROP COLUMN IF EXISTS sale_date_encrypted;
ALTER TABLE public.domains              DROP COLUMN IF EXISTS notes_encrypted;

ALTER TABLE public.domain_transactions  DROP COLUMN IF EXISTS notes_encrypted;
ALTER TABLE public.domain_transactions  DROP COLUMN IF EXISTS receipt_url_encrypted;
ALTER TABLE public.domain_transactions  DROP COLUMN IF EXISTS category_encrypted;

ALTER TABLE public.users                DROP COLUMN IF EXISTS encryption_key;

-- Indexes on the dropped columns are removed automatically by Postgres.
