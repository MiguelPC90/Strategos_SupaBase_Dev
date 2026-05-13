-- ─────────────────────────────────────────────────────────────────────────────
-- 034 — Allow co-existence of program-level and plan-level rows
-- ─────────────────────────────────────────────────────────────────────────────
-- Previously: unique constraint on (user_id, program_id, page) prevented
-- plan-level restriction rows from co-existing with program-level rows for
-- the same (user, program, page) tuple, because plan_id was not part of the
-- unique key.
--
-- New design: two partial unique indices
--   1. Program-level rows (plan_id IS NULL)  — one per (user, program, page)
--   2. Plan-level rows   (plan_id IS NOT NULL) — one per (user, program, plan, page)
--
-- This allows, e.g.:
--   (user_A, prog_X, NULL,   'dashboard', 'view')   — program-wide access
--   (user_A, prog_X, plan_1, 'dashboard', 'denied') — restricted for plan_1
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the old constraint (excludes plan_id from the unique key)
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_user_id_program_id_page_key;

-- Partial unique index for program-level rows (plan_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS user_permissions_program_level_uniq
  ON public.user_permissions (user_id, program_id, page)
  WHERE plan_id IS NULL;

-- Partial unique index for plan-level rows (plan_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS user_permissions_plan_level_uniq
  ON public.user_permissions (user_id, program_id, plan_id, page)
  WHERE plan_id IS NOT NULL;
