-- Migration 028: Create activity_dependencies table
-- Reproduces the schema already in production for environment reproducibility.
-- Idempotent — uses IF NOT EXISTS / conditional DO $$ blocks throughout.
-- Re-running on an existing database does not fail and does not destroy data.

BEGIN;

-- ── 1. Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_dependencies (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  successor_id   uuid        NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  predecessor_id uuid        NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  dep_type       text        NOT NULL CHECK (dep_type IN ('FS','SS','FF','SF')),
  lag_days       integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid        REFERENCES auth.users(id)
);

-- ── 2. Self-reference guard ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'activity_dependencies_no_self_dep'
      AND conrelid = 'public.activity_dependencies'::regclass
  ) THEN
    ALTER TABLE public.activity_dependencies
      ADD CONSTRAINT activity_dependencies_no_self_dep
      CHECK (predecessor_id <> successor_id);
  END IF;
END $$;

-- ── 3. Unique pair constraint ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'activity_dependencies_unique_pair'
      AND conrelid = 'public.activity_dependencies'::regclass
  ) THEN
    ALTER TABLE public.activity_dependencies
      ADD CONSTRAINT activity_dependencies_unique_pair
      UNIQUE (predecessor_id, successor_id);
  END IF;
END $$;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_dependencies_successor_id
  ON public.activity_dependencies (successor_id);

CREATE INDEX IF NOT EXISTS idx_activity_dependencies_predecessor_id
  ON public.activity_dependencies (predecessor_id);

-- ── 5. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.activity_dependencies ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user who can access the successor activity's program
DROP POLICY IF EXISTS "activity_dependencies_select" ON public.activity_dependencies;
CREATE POLICY "activity_dependencies_select" ON public.activity_dependencies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = successor_id
        AND (a.program_id IS NULL OR public.user_has_program_access(a.program_id))
    )
  );

-- INSERT: editor/admin with access to the successor's program
DROP POLICY IF EXISTS "activity_dependencies_insert" ON public.activity_dependencies;
CREATE POLICY "activity_dependencies_insert" ON public.activity_dependencies
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = successor_id
        AND (a.program_id IS NULL OR public.user_has_program_access(a.program_id))
    )
  );

-- UPDATE: editor/admin with access to the successor's program
DROP POLICY IF EXISTS "activity_dependencies_update" ON public.activity_dependencies;
CREATE POLICY "activity_dependencies_update" ON public.activity_dependencies
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = successor_id
        AND (a.program_id IS NULL OR public.user_has_program_access(a.program_id))
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('editor', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = successor_id
        AND (a.program_id IS NULL OR public.user_has_program_access(a.program_id))
    )
  );

-- DELETE: editor/admin with access to the successor's program
DROP POLICY IF EXISTS "activity_dependencies_delete" ON public.activity_dependencies;
CREATE POLICY "activity_dependencies_delete" ON public.activity_dependencies
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN ('editor', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = successor_id
        AND (a.program_id IS NULL OR public.user_has_program_access(a.program_id))
    )
  );

COMMIT;
