-- =============================================================================
-- Migration 036: 3-zone threshold model
-- =============================================================================
-- Date:        2026-05-21
-- Wave:        3a (status logic refactor)
-- Purpose:     Add 4 new threshold columns (low/high) to programs and planos
--              to support a 3-zone status model (Em dia / Em risco / Em atraso)
--              with configurable bands per program and per-plan override.
--
-- Background:
--   Migration 023 introduced single threshold_aggregates and threshold_leaves
--   columns. This produced a binary status model: delta ≤ threshold → Em dia,
--   delta > threshold → Em atraso. There was no clear "Em risco" middle zone.
--
--   Wave 3 introduces a 3-zone model:
--     delta ≤ low                → Em dia (comfort margin)
--     low < delta ≤ high         → Em risco (yellow alert)
--     delta > high               → Em atraso (red alert)
--
-- Backwards compatibility:
--   - Old columns (threshold_aggregates, threshold_leaves) are NOT dropped.
--   - Application code falls back to old columns during transition.
--   - Old columns will be dropped in a later cleanup migration (Wave 3g).
--
-- Defaults applied:
--   - Programs:  aggregates_low=15, aggregates_high=25, leaves_low=5, leaves_high=10
--   - Planos:    NULL (override only when explicitly set via Admin)
-- =============================================================================

-- Step 1: Add columns to programs (with defaults applied to new rows)
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS threshold_aggregates_low  numeric DEFAULT 15,
  ADD COLUMN IF NOT EXISTS threshold_aggregates_high numeric DEFAULT 25,
  ADD COLUMN IF NOT EXISTS threshold_leaves_low      numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS threshold_leaves_high     numeric DEFAULT 10;

-- Step 2: Backfill new defaults on existing rows where NULL
UPDATE programs
SET
  threshold_aggregates_low  = COALESCE(threshold_aggregates_low,  15),
  threshold_aggregates_high = COALESCE(threshold_aggregates_high, 25),
  threshold_leaves_low      = COALESCE(threshold_leaves_low,      5),
  threshold_leaves_high     = COALESCE(threshold_leaves_high,     10)
WHERE
  threshold_aggregates_low  IS NULL OR
  threshold_aggregates_high IS NULL OR
  threshold_leaves_low      IS NULL OR
  threshold_leaves_high     IS NULL;

-- Step 3: Add CHECK constraints (low <= high)
ALTER TABLE programs
  ADD CONSTRAINT programs_thresholds_aggregates_check
    CHECK (threshold_aggregates_low <= threshold_aggregates_high),
  ADD CONSTRAINT programs_thresholds_leaves_check
    CHECK (threshold_leaves_low <= threshold_leaves_high);

-- Step 4: Add columns to planos (nullable — overrides only when set)
ALTER TABLE planos
  ADD COLUMN IF NOT EXISTS threshold_aggregates_low  numeric,
  ADD COLUMN IF NOT EXISTS threshold_aggregates_high numeric,
  ADD COLUMN IF NOT EXISTS threshold_leaves_low      numeric,
  ADD COLUMN IF NOT EXISTS threshold_leaves_high     numeric;

-- Step 5: Add CHECK constraints to planos (only when both low+high are set)
ALTER TABLE planos
  ADD CONSTRAINT planos_thresholds_aggregates_check
    CHECK (
      threshold_aggregates_low IS NULL
      OR threshold_aggregates_high IS NULL
      OR threshold_aggregates_low <= threshold_aggregates_high
    ),
  ADD CONSTRAINT planos_thresholds_leaves_check
    CHECK (
      threshold_leaves_low IS NULL
      OR threshold_leaves_high IS NULL
      OR threshold_leaves_low <= threshold_leaves_high
    );

-- Step 6: Add keys to app_config
INSERT INTO app_config (key, value, updated_at)
VALUES
  ('status_delay_threshold_aggregates_low',  '15', NOW()),
  ('status_delay_threshold_aggregates_high', '25', NOW()),
  ('status_delay_threshold_leaves_low',      '5',  NOW()),
  ('status_delay_threshold_leaves_high',     '10', NOW())
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Rollback (if needed)
-- =============================================================================
--
-- ALTER TABLE programs
--   DROP CONSTRAINT IF EXISTS programs_thresholds_aggregates_check,
--   DROP CONSTRAINT IF EXISTS programs_thresholds_leaves_check,
--   DROP COLUMN IF EXISTS threshold_aggregates_low,
--   DROP COLUMN IF EXISTS threshold_aggregates_high,
--   DROP COLUMN IF EXISTS threshold_leaves_low,
--   DROP COLUMN IF EXISTS threshold_leaves_high;
--
-- ALTER TABLE planos
--   DROP CONSTRAINT IF EXISTS planos_thresholds_aggregates_check,
--   DROP CONSTRAINT IF EXISTS planos_thresholds_leaves_check,
--   DROP COLUMN IF EXISTS threshold_aggregates_low,
--   DROP COLUMN IF EXISTS threshold_aggregates_high,
--   DROP COLUMN IF EXISTS threshold_leaves_low,
--   DROP COLUMN IF EXISTS threshold_leaves_high;
--
-- DELETE FROM app_config
-- WHERE key IN (
--   'status_delay_threshold_aggregates_low',
--   'status_delay_threshold_aggregates_high',
--   'status_delay_threshold_leaves_low',
--   'status_delay_threshold_leaves_high'
-- );
