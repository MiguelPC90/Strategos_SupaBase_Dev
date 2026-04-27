-- Migration 025: Cost roles + people cost columns

BEGIN;

-- ── 1. cost_roles table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cost_per_hour NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (cost_per_hour >= 0)
);

ALTER TABLE public.cost_roles ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "cost_roles_admin_all" ON public.cost_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- All authenticated can read
CREATE POLICY "cost_roles_authenticated_read" ON public.cost_roles
  FOR SELECT TO authenticated
  USING (TRUE);

-- ── 2. Add cost columns to people ─────────────────────────────────────
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS cost_role_id UUID REFERENCES public.cost_roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_per_hour_override NUMERIC,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';

CREATE INDEX IF NOT EXISTS idx_people_cost_role_id ON public.people(cost_role_id);

-- Constraint: override must be non-negative if set
ALTER TABLE public.people
  ADD CONSTRAINT people_cost_per_hour_override_check
  CHECK (cost_per_hour_override IS NULL OR cost_per_hour_override >= 0);

-- ── 3. Helper function — resolve person's hourly cost ────────────────
CREATE OR REPLACE FUNCTION public.resolve_person_hourly_cost(p_person_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    p.cost_per_hour_override,
    cr.cost_per_hour,
    0
  )
  FROM public.people p
  LEFT JOIN public.cost_roles cr ON cr.id = p.cost_role_id
  WHERE p.id = p_person_id;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_person_hourly_cost(UUID) TO authenticated;

-- ── 4. Trigger — auto-snapshot daily_cost on fte_resources insert/update ─
-- When a new fte_resource is created or person_id changes, compute daily_cost
-- from the person's current resolved hourly cost.

CREATE OR REPLACE FUNCTION public.snapshot_fte_daily_cost()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hourly_cost NUMERIC;
BEGIN
  -- Only snapshot if person_id provided and daily_cost not explicitly set
  IF NEW.person_id IS NOT NULL THEN
    -- If daily_cost is NULL or zero, compute from current hourly cost
    IF NEW.daily_cost IS NULL OR NEW.daily_cost = 0 THEN
      SELECT public.resolve_person_hourly_cost(NEW.person_id) INTO hourly_cost;
      NEW.daily_cost := COALESCE(hourly_cost, 0) * 8;  -- 8 hours per day
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fte_resources_snapshot_cost ON public.fte_resources;
CREATE TRIGGER fte_resources_snapshot_cost
  BEFORE INSERT OR UPDATE ON public.fte_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_fte_daily_cost();

-- Note: Existing fte_resources rows keep their current daily_cost.
-- The trigger only fires on future inserts/updates.

COMMIT;
