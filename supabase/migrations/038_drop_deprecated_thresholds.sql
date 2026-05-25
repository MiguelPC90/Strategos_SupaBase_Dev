-- Migration 038: drop deprecated single-value threshold columns and config keys
--
-- Wave 6 Path A, commit 2/2
--
-- Prerequisites (verified before applying):
--   - Wave 6 Path A commit 1 (frontend migration) applied and validated in
--     production on Mac (commit 7fb09b4).
--   - Zero references to threshold_aggregates / threshold_leaves (without
--     _low/_high suffix) in src/.
--   - Zero references to legacy config keys (status_delay_threshold,
--     status_delay_threshold_aggregates, status_delay_threshold_leaves)
--     in src/.
--   - The read layer (rollup.ts, useThresholdsMap) was already on the new
--     band model since Wave 3 (May 2026).
--
-- Impact:
--   - programs.threshold_aggregates DROPPED
--   - programs.threshold_leaves DROPPED
--   - planos.threshold_aggregates DROPPED
--   - planos.threshold_leaves DROPPED
--   - app_config: 3 legacy keys deleted
--
-- Idempotency: uses IF EXISTS / IN filters, safe to re-run.
--
-- Rollback (if needed before applying in production): re-add the columns
-- with their previous types (int4 nullable). Data was already NULL on all
-- planos and was duplicated on programs (both old and new fields had
-- equivalent values pre-migration).
--
-- Applied via Supabase Dashboard SQL Editor (macOS 11 limitation prevents
-- Supabase CLI usage — see CLAUDE.md → Known Issues).


-- ── Step 1: Drop columns from programs ───────────────────────────────
ALTER TABLE programs
  DROP COLUMN IF EXISTS threshold_aggregates,
  DROP COLUMN IF EXISTS threshold_leaves;


-- ── Step 2: Drop columns from planos ─────────────────────────────────
ALTER TABLE planos
  DROP COLUMN IF EXISTS threshold_aggregates,
  DROP COLUMN IF EXISTS threshold_leaves;


-- ── Step 3: Delete deprecated config keys ────────────────────────────
DELETE FROM app_config
WHERE config_key IN (
  'status_delay_threshold',
  'status_delay_threshold_aggregates',
  'status_delay_threshold_leaves'
);


-- ── Verification queries (commented out — uncomment after applying) ──
--
-- 1) Only new threshold columns remain on programs and planos
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE table_name IN ('programs', 'planos') AND column_name LIKE 'threshold%'
-- ORDER BY table_name, column_name;
-- Expected: 8 rows (4 per table, all _low/_high pairs)
--
-- 2) Only new app_config keys remain
-- SELECT config_key FROM app_config
-- WHERE config_key LIKE 'status_delay_threshold%'
-- ORDER BY config_key;
-- Expected: 4 rows (the 4 _low/_high keys)
