-- Migration 023: Per-program and per-plano threshold overrides
-- ────────────────────────────────────────────────────────────────
-- Adds optional threshold columns to programs (NOT NULL with defaults) and
-- planos (nullable — NULL = inherit from program).
--
-- Resolution per activity leaf:
--   threshold_leaves    = plano.threshold_leaves    ?? program.threshold_leaves
--   threshold_aggregates = plano.threshold_aggregates ?? program.threshold_aggregates
--
-- Apply in Supabase SQL editor. DO NOT apply automatically.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS threshold_leaves     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS threshold_aggregates INTEGER NOT NULL DEFAULT 20;

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS threshold_leaves     INTEGER,
  ADD COLUMN IF NOT EXISTS threshold_aggregates INTEGER;

-- Seed program defaults from current global app_config values.
-- Programs keep hardcoded defaults (0 / 20) if the keys are absent.
UPDATE public.programs
SET
  threshold_leaves = COALESCE(
    (SELECT (data)::integer
     FROM public.app_config
     WHERE config_key = 'status_delay_threshold_leaves'
     LIMIT 1),
    0
  ),
  threshold_aggregates = COALESCE(
    (SELECT (data)::integer
     FROM public.app_config
     WHERE config_key = 'status_delay_threshold_aggregates'
     LIMIT 1),
    20
  );

-- Notes:
-- 1. planos rows start with NULL (inherit from program) — no UPDATE needed.
-- 2. Frontend falls back: plano.threshold_leaves ?? program.threshold_leaves.
-- 3. Global app_config thresholds remain as the program-level seed and as
--    fallback in Layout.tsx for pages without per-plano context.
