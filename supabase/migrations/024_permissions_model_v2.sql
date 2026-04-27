-- Migration 024: Permissions model v2
-- 5 roles + 5 access_level values + updated helper functions

BEGIN;

-- ── 1. Update profiles.role check constraint ───────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'program_manager', 'editor', 'sponsor', 'stakeholder'));

-- Note: 'editor' is kept for now (will be renamed to 'project_manager'
-- in pipeline). New roles 'program_manager', 'sponsor', 'stakeholder' added.

-- ── 2. Update user_permissions.access_level check constraint ──────────
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_access_level_check;

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_access_level_check
  CHECK (access_level IN ('full', 'ops', 'view', 'view_ops', 'denied'));

-- Migrate existing rows: 'edit' → 'full', 'view' → 'view'
-- (Existing 'view' stays as 'view'. 'edit' becomes 'full' since old 'edit'
-- meant unlimited editing including financial.)
UPDATE public.user_permissions
SET access_level = CASE access_level
  WHEN 'edit' THEN 'full'
  WHEN 'view' THEN 'view'
  ELSE access_level
END
WHERE access_level IN ('edit', 'view');

-- ── 3. Helper function — is user in role group? ────────────────────────
-- Used by RLS policies. Returns true if user's role allows the action.
-- Roles that can edit (any program/plano): admin, program_manager, editor
-- Roles that only view: sponsor, stakeholder

CREATE OR REPLACE FUNCTION public.user_can_potentially_edit()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'program_manager', 'editor')
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_potentially_edit() TO authenticated;

-- ── 4. Helper function — does user have access to a program ────────────
-- Used by SELECT policies. Returns true if user has any non-denied
-- permission for the program (specific plano or NULL plano fallback).

CREATE OR REPLACE FUNCTION public.user_has_program_access(p_program_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin sees all
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- Has at least one non-denied row for this program
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid()
        AND program_id = p_program_id
        AND access_level != 'denied'
    );
$$;

-- ── 5. Helper function — can user edit a plano on a specific page? ────
-- Used by INSERT/UPDATE/DELETE policies. Resolves the most specific row.
-- Returns true if (after applying override hierarchy):
--   - user has 'full' (edits everything)
--   - user has 'ops' AND the page is NOT financial
-- Returns false for 'view', 'view_ops', 'denied', or no row.

CREATE OR REPLACE FUNCTION public.user_can_edit_program_plano(
  p_program_id UUID,
  p_plano_id UUID,
  p_page TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_level TEXT;
  is_financial_page BOOLEAN;
BEGIN
  -- Admin always allowed
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Sponsor and stakeholder cannot edit
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('sponsor', 'stakeholder')
  ) THEN
    RETURN FALSE;
  END IF;

  -- Resolve access_level via override hierarchy:
  -- 1. Specific plano row > 2. Program-wide row (plan_id IS NULL)
  SELECT access_level INTO resolved_level
  FROM public.user_permissions
  WHERE user_id = auth.uid()
    AND program_id = p_program_id
    AND (
      (p_plano_id IS NOT NULL AND plan_id = p_plano_id)
      OR plan_id IS NULL
    )
  ORDER BY (plan_id IS NOT NULL) DESC  -- specific first
  LIMIT 1;

  -- No matching row → no access
  IF resolved_level IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check page is financial
  is_financial_page := p_page IN ('gestao-financeira', 'exec-financeira');

  -- Apply access_level rules
  CASE resolved_level
    WHEN 'full' THEN
      RETURN TRUE;  -- edits everything
    WHEN 'ops' THEN
      -- edits everything except financial
      RETURN NOT is_financial_page;
    WHEN 'view', 'view_ops', 'denied' THEN
      RETURN FALSE;  -- read-only or blocked
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_can_edit_program_plano(UUID, UUID, TEXT) TO authenticated;

-- ── 6. Update existing RLS policies to use new helper ─────────────────
-- The existing user_can_edit_program_page() function is REPLACED by
-- user_can_edit_program_plano(). We need to update all policies that
-- referenced the old function.

-- Drop the old function (now superseded)
DROP FUNCTION IF EXISTS public.user_can_edit_program_page(UUID, TEXT);

-- Update write policies to use new function with NULL for plan_id
-- (to be refined per-table later when we add plan_id-aware writes)

-- For each scoped table, the WRITE policy needs to call the new function
-- with the resolved plan_id. Tables and their page_key mapping:

-- activities, eixos, planos → 'gestao-iniciativas'
-- pds_entries → 'gestao-pds'
-- risks → 'gestao-riscos'
-- fin_budget_lines, fin_invoices → 'gestao-financeira'

-- For 'planos' table, the row's id IS the plano_id.
-- For 'activities', use plano_id field.
-- For 'pds_entries', 'risks', 'fin_*' — use plano_id field.
-- For 'eixos' — has no plano_id, pass NULL (program-level scope).

-- ── activities ──
DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-iniciativas'
    ))
  );

DROP POLICY IF EXISTS "activities_update" ON public.activities;
CREATE POLICY "activities_update" ON public.activities
  FOR UPDATE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-iniciativas'
    ))
  )
  WITH CHECK (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-iniciativas'
    ))
  );

DROP POLICY IF EXISTS "activities_delete" ON public.activities;
CREATE POLICY "activities_delete" ON public.activities
  FOR DELETE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-iniciativas'
    ))
  );

-- ── eixos ── (program-level, plano_id = NULL)
DROP POLICY IF EXISTS "eixos_insert" ON public.eixos;
CREATE POLICY "eixos_insert" ON public.eixos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_potentially_edit()
    AND public.user_can_edit_program_plano(
      program_id, NULL, 'gestao-iniciativas'
    )
  );

DROP POLICY IF EXISTS "eixos_update" ON public.eixos;
CREATE POLICY "eixos_update" ON public.eixos
  FOR UPDATE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND public.user_can_edit_program_plano(
      program_id, NULL, 'gestao-iniciativas'
    )
  )
  WITH CHECK (
    public.user_can_potentially_edit()
    AND public.user_can_edit_program_plano(
      program_id, NULL, 'gestao-iniciativas'
    )
  );

DROP POLICY IF EXISTS "eixos_delete" ON public.eixos;
CREATE POLICY "eixos_delete" ON public.eixos
  FOR DELETE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND public.user_can_edit_program_plano(
      program_id, NULL, 'gestao-iniciativas'
    )
  );

-- ── planos ── (the row's id IS the plano_id)
DROP POLICY IF EXISTS "planos_insert" ON public.planos;
CREATE POLICY "planos_insert" ON public.planos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_potentially_edit()
    AND public.user_can_edit_program_plano(
      program_id, NULL, 'gestao-iniciativas'
    )
  );

DROP POLICY IF EXISTS "planos_update" ON public.planos;
CREATE POLICY "planos_update" ON public.planos
  FOR UPDATE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND public.user_can_edit_program_plano(
      program_id, id, 'gestao-iniciativas'
    )
  )
  WITH CHECK (
    public.user_can_potentially_edit()
    AND public.user_can_edit_program_plano(
      program_id, id, 'gestao-iniciativas'
    )
  );

DROP POLICY IF EXISTS "planos_delete" ON public.planos;
CREATE POLICY "planos_delete" ON public.planos
  FOR DELETE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND public.user_can_edit_program_plano(
      program_id, id, 'gestao-iniciativas'
    )
  );

-- ── pds_entries ──
DROP POLICY IF EXISTS "pds_entries_insert" ON public.pds_entries;
CREATE POLICY "pds_entries_insert" ON public.pds_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-pds'
    ))
  );

DROP POLICY IF EXISTS "pds_entries_update" ON public.pds_entries;
CREATE POLICY "pds_entries_update" ON public.pds_entries
  FOR UPDATE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-pds'
    ))
  )
  WITH CHECK (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-pds'
    ))
  );

DROP POLICY IF EXISTS "pds_entries_delete" ON public.pds_entries;
CREATE POLICY "pds_entries_delete" ON public.pds_entries
  FOR DELETE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-pds'
    ))
  );

-- ── risks ──
DROP POLICY IF EXISTS "risks_insert" ON public.risks;
CREATE POLICY "risks_insert" ON public.risks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-riscos'
    ))
  );

DROP POLICY IF EXISTS "risks_update" ON public.risks;
CREATE POLICY "risks_update" ON public.risks
  FOR UPDATE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-riscos'
    ))
  )
  WITH CHECK (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-riscos'
    ))
  );

DROP POLICY IF EXISTS "risks_delete" ON public.risks;
CREATE POLICY "risks_delete" ON public.risks
  FOR DELETE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-riscos'
    ))
  );

-- ── fin_budget_lines ──
DROP POLICY IF EXISTS "fin_budget_lines_insert" ON public.fin_budget_lines;
CREATE POLICY "fin_budget_lines_insert" ON public.fin_budget_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-financeira'
    ))
  );

DROP POLICY IF EXISTS "fin_budget_lines_update" ON public.fin_budget_lines;
CREATE POLICY "fin_budget_lines_update" ON public.fin_budget_lines
  FOR UPDATE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-financeira'
    ))
  )
  WITH CHECK (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-financeira'
    ))
  );

DROP POLICY IF EXISTS "fin_budget_lines_delete" ON public.fin_budget_lines;
CREATE POLICY "fin_budget_lines_delete" ON public.fin_budget_lines
  FOR DELETE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-financeira'
    ))
  );

-- ── fin_invoices ──
DROP POLICY IF EXISTS "fin_invoices_insert" ON public.fin_invoices;
CREATE POLICY "fin_invoices_insert" ON public.fin_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-financeira'
    ))
  );

DROP POLICY IF EXISTS "fin_invoices_update" ON public.fin_invoices;
CREATE POLICY "fin_invoices_update" ON public.fin_invoices
  FOR UPDATE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-financeira'
    ))
  )
  WITH CHECK (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-financeira'
    ))
  );

DROP POLICY IF EXISTS "fin_invoices_delete" ON public.fin_invoices;
CREATE POLICY "fin_invoices_delete" ON public.fin_invoices
  FOR DELETE TO authenticated
  USING (
    public.user_can_potentially_edit()
    AND (program_id IS NULL OR public.user_can_edit_program_plano(
      program_id, plano_id, 'gestao-financeira'
    ))
  );

COMMIT;
