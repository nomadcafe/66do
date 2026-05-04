-- Migrate domains.tags from text (JSON-encoded) → jsonb (native).
--
-- Why now:
--   text-encoded JSON works but blocks SQL-side analytics. With jsonb you can
--   query "all .ai domains tagged 'aged'" via WHERE tags @> '["aged"]'.
--   Future tag-distribution charts / "buyers who bought X also tagged Y"
--   analyses can't run against text.
--
-- Why this is low-risk:
--   - Existing values are already valid JSON arrays (every write goes through
--     JSON.stringify(domain.tags) — see useDashboardData.ts:269 pre-migration).
--   - text → jsonb cast in Postgres parses the contents as JSON. Result:
--     '["foo","bar"]' (text) → ["foo","bar"] (jsonb) — no data shape change,
--     just storage format change.
--   - NULL stays NULL.
--   - Code already tolerates both shapes (ensureDomainWithTags has both
--     Array.isArray and string-parse branches), so old & new code work
--     against the new column.
--
-- Run order (important):
--   1. (this script's audit block) — verify no rows would block the cast.
--      If audit_suspicious > 0, inspect & fix those rows manually before
--      proceeding with the ALTER COLUMN. Stop here and ask.
--   2. ALTER COLUMN — runs in seconds on a 223-row table.
--   3. (optional, post-deploy) — remove the now-redundant string-parse
--      branches from ensureDomainWithTags and validation.ts.

-- ============================================================
-- Audit block — read-only, run first
-- ============================================================
-- Expected on a healthy table: total = some number, null_count + empty_array
-- + has_tags = total, audit_suspicious = 0.
SELECT
  COUNT(*)                                           AS total,
  COUNT(*) FILTER (WHERE tags IS NULL)               AS null_count,
  COUNT(*) FILTER (WHERE tags = '[]')                AS empty_array,
  COUNT(*) FILTER (WHERE tags IS NOT NULL AND tags != '[]') AS has_tags,
  -- "suspicious": non-NULL but doesn't look like a JSON array. Would block
  -- the text → jsonb cast below. Should be 0; if not, those rows need
  -- manual cleanup before running the ALTER COLUMN.
  COUNT(*) FILTER (
    WHERE tags IS NOT NULL
      AND tags != ''
      AND tags !~ '^\[.*\]$'
  )                                                  AS audit_suspicious
FROM public.domains;

-- ============================================================
-- Defensive backfill — clean up edge cases the cast would choke on
-- ============================================================
-- Sets garbage / empty-string values to '[]' so the cast succeeds. NULL
-- stays NULL (jsonb supports NULL natively). Idempotent.
UPDATE public.domains
SET tags = '[]'
WHERE tags IS NOT NULL
  AND (tags = '' OR tags !~ '^\[.*\]$');

-- ============================================================
-- The actual conversion
-- ============================================================
-- USING tags::jsonb tells Postgres to interpret the existing text as JSON
-- and store the parsed value. This is fast (one pass over the table) and
-- safe given the audit + backfill above.
ALTER TABLE public.domains
  ALTER COLUMN tags TYPE jsonb USING tags::jsonb;

-- ============================================================
-- Optional: GIN index for tag-membership queries
-- ============================================================
-- Adds support for fast `WHERE tags @> '["foo"]'` lookups. Costs a tiny
-- amount of disk + write overhead. Skip if you don't plan to filter by tag.
CREATE INDEX IF NOT EXISTS domains_tags_gin_idx
  ON public.domains USING gin (tags);

-- ============================================================
-- Tracker
-- ============================================================
INSERT INTO public.schema_migrations (filename, notes)
VALUES (
  'migrate_tags_to_jsonb.sql',
  'Convert domains.tags from text(JSON-encoded) to native jsonb; add GIN index for tag-membership filtering.'
)
ON CONFLICT (filename) DO NOTHING;
