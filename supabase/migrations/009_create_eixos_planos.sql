-- Migration 009: Create eixos and planos tables
-- Depends on: 008_add_pds_program_columns.sql (pds_entries.program_id)
-- Safe to run multiple times — all statements use IF NOT EXISTS / DO $$ guards.

-- ── 1. EIXOS ─────────────────────────────────────────────────────────────────
-- Strategic axes (Eixos Estratégicos) scoped to a program.
-- name must be unique per program because daily_snapshot() joins via
--   JOIN eixos e ON e.name = a.n1 AND e.program_id = a.program_id
-- A non-unique name would produce duplicate rows in that aggregation.

CREATE TABLE IF NOT EXISTS public.eixos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID        REFERENCES public.programs(id) ON DELETE CASCADE,
  code       TEXT        NOT NULL DEFAULT '',
  name       TEXT        NOT NULL DEFAULT '',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID        REFERENCES auth.users(id),
  UNIQUE (program_id, name)
);

CREATE INDEX IF NOT EXISTS idx_eixos_program_id  ON public.eixos(program_id);
CREATE INDEX IF NOT EXISTS idx_eixos_sort_order  ON public.eixos(sort_order);

-- ── 2. PLANOS ────────────────────────────────────────────────────────────────
-- Strategic plans (Planos) belonging to an eixo.
-- program_id is denormalised from eixos.program_id for convenient filtering
-- without an extra JOIN in usePlanos / FilterContext.

CREATE TABLE IF NOT EXISTS public.planos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  eixo_id    UUID        NOT NULL REFERENCES public.eixos(id) ON DELETE CASCADE,
  program_id UUID        REFERENCES public.programs(id) ON DELETE SET NULL,
  code       TEXT        NOT NULL DEFAULT '',
  name       TEXT        NOT NULL DEFAULT '',
  owner      TEXT,
  sponsor    TEXT,
  start_date DATE,
  end_date   DATE,
  objective  TEXT,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_planos_eixo_id    ON public.planos(eixo_id);
CREATE INDEX IF NOT EXISTS idx_planos_program_id ON public.planos(program_id);
CREATE INDEX IF NOT EXISTS idx_planos_sort_order ON public.planos(sort_order);

-- ── 3. AUTO updated_at TRIGGERS ──────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['eixos', 'planos'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || t || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%I_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        t, t
      );
    END IF;
  END LOOP;
END;
$$;

-- ── 4. CHANGE LOG TRIGGERS ───────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['eixos', 'planos'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || t || '_log'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%I_log
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.log_change()',
        t, t
      );
    END IF;
  END LOOP;
END;
$$;

-- ── 5. ROW LEVEL SECURITY ────────────────────────────────────────────────────
ALTER TABLE public.eixos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

-- eixos: matches activities pattern (admin-only delete — structural table)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='eixos' AND policyname='eixo_select') THEN
    CREATE POLICY "eixo_select" ON public.eixos
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='eixos' AND policyname='eixo_insert') THEN
    CREATE POLICY "eixo_insert" ON public.eixos
      FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='eixos' AND policyname='eixo_update') THEN
    CREATE POLICY "eixo_update" ON public.eixos
      FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='eixos' AND policyname='eixo_delete') THEN
    CREATE POLICY "eixo_delete" ON public.eixos
      FOR DELETE TO authenticated USING (public.current_user_role() = 'admin');
  END IF;
END $$;

-- planos: same pattern as eixos (admin-only delete)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='planos' AND policyname='plano_select') THEN
    CREATE POLICY "plano_select" ON public.planos
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='planos' AND policyname='plano_insert') THEN
    CREATE POLICY "plano_insert" ON public.planos
      FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='planos' AND policyname='plano_update') THEN
    CREATE POLICY "plano_update" ON public.planos
      FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='planos' AND policyname='plano_delete') THEN
    CREATE POLICY "plano_delete" ON public.planos
      FOR DELETE TO authenticated USING (public.current_user_role() = 'admin');
  END IF;
END $$;
