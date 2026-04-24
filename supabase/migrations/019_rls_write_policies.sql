-- Migration 019: Program-scoped INSERT/UPDATE/DELETE policies (Phase 3)
-- Adds user_has_program_access() check to all write policies.
-- Requires: migrations 016/018 (user_has_program_access function).
-- Idempotent: safe to re-run (DROP IF EXISTS + CREATE).
--
-- Pattern:
--   INSERT/UPDATE WITH CHECK: role check AND program scope
--   UPDATE USING:             role check AND program scope (prevents editing rows you can't see)
--   DELETE USING:             role check AND program scope
--
-- activities, pds_entries, risks, fin_budget_lines, fin_invoices:
--   use (program_id IS NULL OR user_has_program_access(program_id))
--   because program_id can be NULL on legacy rows — those remain writable.
--
-- eixos, planos:
--   use user_has_program_access(program_id) directly (no NULL guard)
--   consistent with their SELECT policy in migration 017.

-- ── activities ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "act_insert"        ON public.activities;
DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

DROP POLICY IF EXISTS "act_update"        ON public.activities;
DROP POLICY IF EXISTS "activities_update" ON public.activities;
CREATE POLICY "activities_update" ON public.activities
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

DROP POLICY IF EXISTS "act_delete"        ON public.activities;
DROP POLICY IF EXISTS "activities_delete" ON public.activities;
CREATE POLICY "activities_delete" ON public.activities
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

-- ── eixos ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "eixo_insert"  ON public.eixos;
DROP POLICY IF EXISTS "eixos_insert" ON public.eixos;
CREATE POLICY "eixos_insert" ON public.eixos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_has_program_access(program_id)
  );

DROP POLICY IF EXISTS "eixo_update"  ON public.eixos;
DROP POLICY IF EXISTS "eixos_update" ON public.eixos;
CREATE POLICY "eixos_update" ON public.eixos
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_has_program_access(program_id)
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_has_program_access(program_id)
  );

DROP POLICY IF EXISTS "eixo_delete"  ON public.eixos;
DROP POLICY IF EXISTS "eixos_delete" ON public.eixos;
CREATE POLICY "eixos_delete" ON public.eixos
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND public.user_has_program_access(program_id)
  );

-- ── planos ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "plano_insert"  ON public.planos;
DROP POLICY IF EXISTS "planos_insert" ON public.planos;
CREATE POLICY "planos_insert" ON public.planos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_has_program_access(program_id)
  );

DROP POLICY IF EXISTS "plano_update"  ON public.planos;
DROP POLICY IF EXISTS "planos_update" ON public.planos;
CREATE POLICY "planos_update" ON public.planos
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_has_program_access(program_id)
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_has_program_access(program_id)
  );

DROP POLICY IF EXISTS "plano_delete"  ON public.planos;
DROP POLICY IF EXISTS "planos_delete" ON public.planos;
CREATE POLICY "planos_delete" ON public.planos
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND public.user_has_program_access(program_id)
  );

-- ── pds_entries ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pds_insert"         ON public.pds_entries;
DROP POLICY IF EXISTS "pds_entries_insert" ON public.pds_entries;
CREATE POLICY "pds_entries_insert" ON public.pds_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

DROP POLICY IF EXISTS "pds_update"         ON public.pds_entries;
DROP POLICY IF EXISTS "pds_entries_update" ON public.pds_entries;
CREATE POLICY "pds_entries_update" ON public.pds_entries
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

DROP POLICY IF EXISTS "pds_delete"         ON public.pds_entries;
DROP POLICY IF EXISTS "pds_entries_delete" ON public.pds_entries;
CREATE POLICY "pds_entries_delete" ON public.pds_entries
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

-- ── risks ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "risk_insert"  ON public.risks;
DROP POLICY IF EXISTS "risks_insert" ON public.risks;
CREATE POLICY "risks_insert" ON public.risks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

DROP POLICY IF EXISTS "risk_update"  ON public.risks;
DROP POLICY IF EXISTS "risks_update" ON public.risks;
CREATE POLICY "risks_update" ON public.risks
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

DROP POLICY IF EXISTS "risk_delete"  ON public.risks;
DROP POLICY IF EXISTS "risks_delete" ON public.risks;
CREATE POLICY "risks_delete" ON public.risks
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

-- ── fin_budget_lines ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rub_insert"              ON public.fin_budget_lines;
DROP POLICY IF EXISTS "fin_budget_lines_insert" ON public.fin_budget_lines;
CREATE POLICY "fin_budget_lines_insert" ON public.fin_budget_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

DROP POLICY IF EXISTS "rub_update"              ON public.fin_budget_lines;
DROP POLICY IF EXISTS "fin_budget_lines_update" ON public.fin_budget_lines;
CREATE POLICY "fin_budget_lines_update" ON public.fin_budget_lines
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

DROP POLICY IF EXISTS "rub_delete"              ON public.fin_budget_lines;
DROP POLICY IF EXISTS "fin_budget_lines_delete" ON public.fin_budget_lines;
CREATE POLICY "fin_budget_lines_delete" ON public.fin_budget_lines
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

-- ── fin_invoices ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fat_insert"          ON public.fin_invoices;
DROP POLICY IF EXISTS "fin_invoices_insert" ON public.fin_invoices;
CREATE POLICY "fin_invoices_insert" ON public.fin_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

DROP POLICY IF EXISTS "fat_update"          ON public.fin_invoices;
DROP POLICY IF EXISTS "fin_invoices_update" ON public.fin_invoices;
CREATE POLICY "fin_invoices_update" ON public.fin_invoices
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );

DROP POLICY IF EXISTS "fat_delete"          ON public.fin_invoices;
DROP POLICY IF EXISTS "fin_invoices_delete" ON public.fin_invoices;
CREATE POLICY "fin_invoices_delete" ON public.fin_invoices
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (program_id IS NULL OR public.user_has_program_access(program_id))
  );
