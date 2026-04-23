-- Migration 017: Program-scoped SELECT policies
-- Replaces broad USING(true) SELECT policies with user_has_program_access() checks.
-- Requires: migration 016 (user_has_program_access function must exist).
-- Idempotent: safe to re-run (DROP IF EXISTS + CREATE).

-- ── programs ─────────────────────────────────────────────────────────────────
-- No SELECT policy existed; enable RLS and add one.
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programs_select" ON public.programs;
CREATE POLICY "programs_select" ON public.programs
  FOR SELECT TO authenticated
  USING (public.user_has_program_access(id));

-- ── eixos ────────────────────────────────────────────────────────────────────
-- Replaces "eixo_select" (migration 009, USING true).
DROP POLICY IF EXISTS "eixo_select"  ON public.eixos;
DROP POLICY IF EXISTS "eixos_select" ON public.eixos;
CREATE POLICY "eixos_select" ON public.eixos
  FOR SELECT TO authenticated
  USING (public.user_has_program_access(program_id));

-- ── planos ───────────────────────────────────────────────────────────────────
-- Replaces "plano_select" (migration 009, USING true).
DROP POLICY IF EXISTS "plano_select"  ON public.planos;
DROP POLICY IF EXISTS "planos_select" ON public.planos;
CREATE POLICY "planos_select" ON public.planos
  FOR SELECT TO authenticated
  USING (public.user_has_program_access(program_id));

-- ── activities ───────────────────────────────────────────────────────────────
-- Replaces "act_select" (schema.sql, USING true).
-- NULL guard covers legacy rows pre-dating the React migration (program_id not yet set).
DROP POLICY IF EXISTS "act_select"        ON public.activities;
DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO authenticated
  USING (program_id IS NULL OR public.user_has_program_access(program_id));

-- ── pds_entries ──────────────────────────────────────────────────────────────
-- Replaces "pds_select" (schema.sql, USING true).
DROP POLICY IF EXISTS "pds_select"         ON public.pds_entries;
DROP POLICY IF EXISTS "pds_entries_select" ON public.pds_entries;
CREATE POLICY "pds_entries_select" ON public.pds_entries
  FOR SELECT TO authenticated
  USING (program_id IS NULL OR public.user_has_program_access(program_id));

-- ── risks ────────────────────────────────────────────────────────────────────
-- Replaces "risk_select" (schema.sql, USING true).
DROP POLICY IF EXISTS "risk_select"  ON public.risks;
DROP POLICY IF EXISTS "risks_select" ON public.risks;
CREATE POLICY "risks_select" ON public.risks
  FOR SELECT TO authenticated
  USING (program_id IS NULL OR public.user_has_program_access(program_id));

-- ── fin_budget_lines ─────────────────────────────────────────────────────────
-- Replaces "rub_select" (schema.sql, USING true).
DROP POLICY IF EXISTS "rub_select"              ON public.fin_budget_lines;
DROP POLICY IF EXISTS "fin_budget_lines_select" ON public.fin_budget_lines;
CREATE POLICY "fin_budget_lines_select" ON public.fin_budget_lines
  FOR SELECT TO authenticated
  USING (program_id IS NULL OR public.user_has_program_access(program_id));

-- ── fin_invoices ─────────────────────────────────────────────────────────────
-- Replaces "fat_select" (schema.sql, USING true).
DROP POLICY IF EXISTS "fat_select"          ON public.fin_invoices;
DROP POLICY IF EXISTS "fin_invoices_select" ON public.fin_invoices;
CREATE POLICY "fin_invoices_select" ON public.fin_invoices
  FOR SELECT TO authenticated
  USING (program_id IS NULL OR public.user_has_program_access(program_id));
