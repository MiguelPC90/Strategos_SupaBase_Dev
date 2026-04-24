-- Migration 021: Enforce access_level (view/edit) in write policies (Phase 4)
-- Replaces Phase 3 program-scope write policies with page+access_level checks.
-- Requires: migrations 016/018 (user_has_program_access), 019 (Phase 3 policies).
-- Idempotent: safe to re-run (DROP IF EXISTS + CREATE OR REPLACE).

-- ── Helper function ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_can_edit_program_page(
  p_program_id UUID,
  p_page TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin can edit everything
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
    OR
    -- User has explicit edit permission for this program + page
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id     = auth.uid()
        AND program_id  = p_program_id
        AND page        = p_page
        AND access_level = 'edit'
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_edit_program_page(UUID, TEXT) TO authenticated;

-- ── activities (page: gestao-iniciativas) ────────────────────────────────────
DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
    )
  );

DROP POLICY IF EXISTS "activities_update" ON public.activities;
CREATE POLICY "activities_update" ON public.activities
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
    )
  );

DROP POLICY IF EXISTS "activities_delete" ON public.activities;
CREATE POLICY "activities_delete" ON public.activities
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
    )
  );

-- ── eixos (page: gestao-iniciativas) ─────────────────────────────────────────
DROP POLICY IF EXISTS "eixos_insert" ON public.eixos;
CREATE POLICY "eixos_insert" ON public.eixos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
  );

DROP POLICY IF EXISTS "eixos_update" ON public.eixos;
CREATE POLICY "eixos_update" ON public.eixos
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
  );

DROP POLICY IF EXISTS "eixos_delete" ON public.eixos;
CREATE POLICY "eixos_delete" ON public.eixos
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
  );

-- ── planos (page: gestao-iniciativas) ────────────────────────────────────────
DROP POLICY IF EXISTS "planos_insert" ON public.planos;
CREATE POLICY "planos_insert" ON public.planos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
  );

DROP POLICY IF EXISTS "planos_update" ON public.planos;
CREATE POLICY "planos_update" ON public.planos
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
  );

DROP POLICY IF EXISTS "planos_delete" ON public.planos;
CREATE POLICY "planos_delete" ON public.planos
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND public.user_can_edit_program_page(program_id, 'gestao-iniciativas')
  );

-- ── pds_entries (page: gestao-pds) ───────────────────────────────────────────
DROP POLICY IF EXISTS "pds_entries_insert" ON public.pds_entries;
CREATE POLICY "pds_entries_insert" ON public.pds_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-pds')
    )
  );

DROP POLICY IF EXISTS "pds_entries_update" ON public.pds_entries;
CREATE POLICY "pds_entries_update" ON public.pds_entries
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-pds')
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-pds')
    )
  );

DROP POLICY IF EXISTS "pds_entries_delete" ON public.pds_entries;
CREATE POLICY "pds_entries_delete" ON public.pds_entries
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-pds')
    )
  );

-- ── risks (page: gestao-riscos) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "risks_insert" ON public.risks;
CREATE POLICY "risks_insert" ON public.risks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-riscos')
    )
  );

DROP POLICY IF EXISTS "risks_update" ON public.risks;
CREATE POLICY "risks_update" ON public.risks
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-riscos')
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-riscos')
    )
  );

DROP POLICY IF EXISTS "risks_delete" ON public.risks;
CREATE POLICY "risks_delete" ON public.risks
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-riscos')
    )
  );

-- ── fin_budget_lines (page: gestao-financeira) ───────────────────────────────
DROP POLICY IF EXISTS "fin_budget_lines_insert" ON public.fin_budget_lines;
CREATE POLICY "fin_budget_lines_insert" ON public.fin_budget_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-financeira')
    )
  );

DROP POLICY IF EXISTS "fin_budget_lines_update" ON public.fin_budget_lines;
CREATE POLICY "fin_budget_lines_update" ON public.fin_budget_lines
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-financeira')
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-financeira')
    )
  );

DROP POLICY IF EXISTS "fin_budget_lines_delete" ON public.fin_budget_lines;
CREATE POLICY "fin_budget_lines_delete" ON public.fin_budget_lines
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-financeira')
    )
  );

-- ── fin_invoices (page: gestao-financeira) ───────────────────────────────────
DROP POLICY IF EXISTS "fin_invoices_insert" ON public.fin_invoices;
CREATE POLICY "fin_invoices_insert" ON public.fin_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-financeira')
    )
  );

DROP POLICY IF EXISTS "fin_invoices_update" ON public.fin_invoices;
CREATE POLICY "fin_invoices_update" ON public.fin_invoices
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-financeira')
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-financeira')
    )
  );

DROP POLICY IF EXISTS "fin_invoices_delete" ON public.fin_invoices;
CREATE POLICY "fin_invoices_delete" ON public.fin_invoices
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND (
      program_id IS NULL
      OR public.user_can_edit_program_page(program_id, 'gestao-financeira')
    )
  );
