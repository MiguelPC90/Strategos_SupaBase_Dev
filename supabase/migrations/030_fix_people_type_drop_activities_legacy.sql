-- ─────────────────────────────────────────────────────────────
-- 030 — Fix people.type semantics + drop activities legacy cols
-- ─────────────────────────────────────────────────────────────
-- Problem 1: people.type was used three conflicting ways:
--   · migration 004 designed as 'internal'/'external' (EN)
--   · Admin UI repurposed as company name free-text ("Empresa")
--   · GestaoRecursos pre-fill expected 'Interno'/'Externo' (PT)
--
-- Fix: split into two purpose-built columns:
--   · company TEXT    — replaces Admin "Empresa" free-text usage
--   · is_external BOOLEAN NOT NULL DEFAULT false
--                     — replaces Interno/Externo classification
--
-- Problem 2: activities.owner and activities.sponsor are legacy
-- text columns from the original schema, never populated in the
-- current UI (0 rows with content). Owner/Sponsor live on planos.
--
-- Fix: drop both legacy columns.
-- ─────────────────────────────────────────────────────────────

-- 1. Add new columns
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;

-- 2. Migrate existing data: preserve whatever was in type as company
UPDATE public.people
SET company = type
WHERE type IS NOT NULL AND type <> '';

-- 3. Backfill is_external from type where it held classification values
UPDATE public.people
SET is_external = true
WHERE lower(type) IN ('externo', 'external');

-- 4. Drop the old ambiguous column
ALTER TABLE public.people
  DROP COLUMN IF EXISTS type;

-- 5. Drop legacy activities columns (0 content rows, superseded by planos)
ALTER TABLE public.activities
  DROP COLUMN IF EXISTS owner,
  DROP COLUMN IF EXISTS sponsor;
