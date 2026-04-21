-- Migration 008: Add program linkage and sort_order to pds_entries
-- These columns are required by the React frontend but were missing from schema.
-- Safe to run multiple times — uses ADD COLUMN IF NOT EXISTS.
--
-- NOTE: plano_id is stored as a plain UUID (no FK) because the planos table
-- is created in migration 009. A FK constraint can be added later if needed.

ALTER TABLE public.pds_entries
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plano_id   UUID,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pds_program_id ON public.pds_entries(program_id);
CREATE INDEX IF NOT EXISTS idx_pds_plano_id   ON public.pds_entries(plano_id);
CREATE INDEX IF NOT EXISTS idx_pds_sort_order ON public.pds_entries(sort_order);
