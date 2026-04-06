-- ============================================================
-- Strategos PMO — Supabase Schema (idempotent — safe to re-run)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. USER PROFILES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  tabs       JSONB NOT NULL DEFAULT '{}'::jsonb,
  n0s        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS n0s JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── 2. USER METADATA ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_metadata (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  profile_id   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  role         TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('admin','editor','viewer')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. ACTIVITIES & GANTT ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activities (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source     TEXT NOT NULL CHECK (source IN ('act','gantt')),
  level      INTEGER NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  n0         TEXT NOT NULL DEFAULT '',
  n1         TEXT NOT NULL DEFAULT '',
  n2         TEXT NOT NULL DEFAULT '',
  n3         TEXT NOT NULL DEFAULT '',
  id0        TEXT NOT NULL DEFAULT '1',
  id1        TEXT NOT NULL DEFAULT '',
  id2        TEXT NOT NULL DEFAULT '',
  bs         DATE,
  bf         DATE,
  rs         DATE,
  rf         DATE,
  pct        NUMERIC(5,2) NOT NULL DEFAULT 0,
  pct_prev   NUMERIC(5,2) NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'On track',
  sponsor    TEXT NOT NULL DEFAULT '',
  owner      TEXT NOT NULL DEFAULT '',
  finish     DATE,
  notes      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_activities_source  ON public.activities(source);
CREATE INDEX IF NOT EXISTS idx_activities_n0_n1   ON public.activities(n0, n1);
CREATE INDEX IF NOT EXISTS idx_activities_id0_id2 ON public.activities(id0, id2);
CREATE INDEX IF NOT EXISTS idx_activities_level   ON public.activities(level);

-- ── 4. PLAN ENTRIES (PDS) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pds_entries (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id0                 TEXT NOT NULL DEFAULT '1',
  id1                 TEXT NOT NULL DEFAULT '',
  id2                 TEXT NOT NULL DEFAULT '',
  plan_name           TEXT NOT NULL DEFAULT '',
  n0                  TEXT NOT NULL DEFAULT '',
  n1                  TEXT NOT NULL DEFAULT '',
  commitments_items   JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress_items      JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_steps_items    JSONB NOT NULL DEFAULT '[]'::jsonb,
  attention_items     JSONB NOT NULL DEFAULT '[]'::jsonb,
  commitments         TEXT,
  progress            TEXT,
  next_steps          TEXT,
  attention           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID REFERENCES auth.users(id),
  UNIQUE(id0, id2)
);

CREATE INDEX IF NOT EXISTS idx_pds_id0_id2 ON public.pds_entries(id0, id2);
CREATE INDEX IF NOT EXISTS idx_pds_n0_n1   ON public.pds_entries(n0, n1);

-- ── 5. RISKS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.risks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id      UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  impact      INTEGER NOT NULL DEFAULT 1 CHECK (impact BETWEEN 1 AND 5),
  probability INTEGER NOT NULL DEFAULT 1 CHECK (probability BETWEEN 1 AND 5),
  status      TEXT NOT NULL DEFAULT 'Open',
  mitigation  TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_risks_pds_id ON public.risks(pds_id);

-- ── 6. FINANCES — BUDGET LINES ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_budget_lines (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id     UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  app_id     TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT '',
  capex      BOOLEAN NOT NULL DEFAULT false,
  currency   TEXT NOT NULL DEFAULT '€',
  values     JSONB NOT NULL DEFAULT '{}'::jsonb,
  note       TEXT,
  source_ref TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fin_budget_lines_pds_id ON public.fin_budget_lines(pds_id);

-- ── 7. FINANCES — CONTRACTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_contracts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id            UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  app_id            TEXT NOT NULL DEFAULT '',
  supplier          TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT '',
  currency          TEXT NOT NULL DEFAULT '€',
  exchange_rate_ref NUMERIC,
  total_amount      NUMERIC NOT NULL DEFAULT 0,
  award_date        DATE,
  description       TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fin_contracts_pds_id ON public.fin_contracts(pds_id);

-- ── 8. FINANCES — INVOICES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_invoices (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id           UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  contract_id      UUID REFERENCES public.fin_contracts(id) ON DELETE SET NULL,
  app_id           TEXT NOT NULL DEFAULT '',
  app_contract_id  TEXT NOT NULL DEFAULT '',
  ref              TEXT NOT NULL DEFAULT '',
  supplier         TEXT NOT NULL DEFAULT '',
  doc_type         TEXT,
  description      TEXT,
  amount           NUMERIC NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT '€',
  exchange_rate    NUMERIC,
  issue_date       DATE,
  due_date         DATE,
  payment_date     DATE,
  status           TEXT NOT NULL DEFAULT 'Pending',
  memo             TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fin_invoices_pds_id      ON public.fin_invoices(pds_id);
CREATE INDEX IF NOT EXISTS idx_fin_invoices_contract_id ON public.fin_invoices(contract_id);

-- ── 9. SNAPSHOTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.snapshots (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label      TEXT NOT NULL,
  snap_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
  kpi        JSONB NOT NULL DEFAULT '{}'::jsonb,
  by_n1      JSONB NOT NULL DEFAULT '{}'::jsonb,
  by_n0      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON public.snapshots(snap_date DESC);

-- ── 10. CHANGE LOG ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.change_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id  UUID NOT NULL,
  operation  TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_values JSONB,
  new_values JSONB,
  summary    TEXT
);

CREATE INDEX IF NOT EXISTS idx_change_log_record     ON public.change_log(record_id);
CREATE INDEX IF NOT EXISTS idx_change_log_table      ON public.change_log(table_name);
CREATE INDEX IF NOT EXISTS idx_change_log_changed_at ON public.change_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_user       ON public.change_log(changed_by);

-- ── 11. APP CONFIG ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT UNIQUE NOT NULL DEFAULT 'main',
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO public.app_config (config_key, data)
VALUES ('main', '{}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;


-- ============================================================
-- TRIGGERS: auto updated_at (idempotent)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_profiles','user_metadata',
    'activities','pds_entries','risks',
    'fin_budget_lines','fin_contracts','fin_invoices','app_config'
  ] LOOP
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


-- ============================================================
-- TRIGGER: auto change_log (idempotent)
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.change_log
    (table_name, record_id, operation, changed_by, old_values, new_values)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    COALESCE(NEW.updated_by, OLD.updated_by),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'activities','pds_entries','risks',
    'fin_budget_lines','fin_contracts','fin_invoices'
  ] LOOP
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


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_metadata    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pds_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_contracts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_invoices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config       ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.user_metadata WHERE id = auth.uid();
$$;

-- ── activities ───────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activities' AND policyname='act_select') THEN
    CREATE POLICY "act_select" ON public.activities FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activities' AND policyname='act_insert') THEN
    CREATE POLICY "act_insert" ON public.activities FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activities' AND policyname='act_update') THEN
    CREATE POLICY "act_update" ON public.activities FOR UPDATE TO authenticated USING (true) WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activities' AND policyname='act_delete') THEN
    CREATE POLICY "act_delete" ON public.activities FOR DELETE TO authenticated USING (public.current_user_role() = 'admin');
  END IF;
END $$;

-- ── pds_entries ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pds_entries' AND policyname='pds_select') THEN
    CREATE POLICY "pds_select" ON public.pds_entries FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pds_entries' AND policyname='pds_insert') THEN
    CREATE POLICY "pds_insert" ON public.pds_entries FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pds_entries' AND policyname='pds_update') THEN
    CREATE POLICY "pds_update" ON public.pds_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pds_entries' AND policyname='pds_delete') THEN
    CREATE POLICY "pds_delete" ON public.pds_entries FOR DELETE TO authenticated USING (public.current_user_role() = 'admin');
  END IF;
END $$;

-- ── risks ────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='risks' AND policyname='risk_select') THEN
    CREATE POLICY "risk_select" ON public.risks FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='risks' AND policyname='risk_insert') THEN
    CREATE POLICY "risk_insert" ON public.risks FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='risks' AND policyname='risk_update') THEN
    CREATE POLICY "risk_update" ON public.risks FOR UPDATE TO authenticated USING (true) WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='risks' AND policyname='risk_delete') THEN
    CREATE POLICY "risk_delete" ON public.risks FOR DELETE TO authenticated USING (public.current_user_role() IN ('editor','admin'));
  END IF;
END $$;

-- ── fin_budget_lines ─────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_budget_lines' AND policyname='rub_select') THEN
    CREATE POLICY "rub_select" ON public.fin_budget_lines FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_budget_lines' AND policyname='rub_insert') THEN
    CREATE POLICY "rub_insert" ON public.fin_budget_lines FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_budget_lines' AND policyname='rub_update') THEN
    CREATE POLICY "rub_update" ON public.fin_budget_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_budget_lines' AND policyname='rub_delete') THEN
    CREATE POLICY "rub_delete" ON public.fin_budget_lines FOR DELETE TO authenticated USING (public.current_user_role() IN ('editor','admin'));
  END IF;
END $$;

-- ── fin_contracts ────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_contracts' AND policyname='cnt_select') THEN
    CREATE POLICY "cnt_select" ON public.fin_contracts FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_contracts' AND policyname='cnt_insert') THEN
    CREATE POLICY "cnt_insert" ON public.fin_contracts FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_contracts' AND policyname='cnt_update') THEN
    CREATE POLICY "cnt_update" ON public.fin_contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_contracts' AND policyname='cnt_delete') THEN
    CREATE POLICY "cnt_delete" ON public.fin_contracts FOR DELETE TO authenticated USING (public.current_user_role() IN ('editor','admin'));
  END IF;
END $$;

-- ── fin_invoices ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_invoices' AND policyname='fat_select') THEN
    CREATE POLICY "fat_select" ON public.fin_invoices FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_invoices' AND policyname='fat_insert') THEN
    CREATE POLICY "fat_insert" ON public.fin_invoices FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_invoices' AND policyname='fat_update') THEN
    CREATE POLICY "fat_update" ON public.fin_invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_invoices' AND policyname='fat_delete') THEN
    CREATE POLICY "fat_delete" ON public.fin_invoices FOR DELETE TO authenticated USING (public.current_user_role() IN ('editor','admin'));
  END IF;
END $$;

-- ── snapshots ────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='snapshots' AND policyname='snap_select') THEN
    CREATE POLICY "snap_select" ON public.snapshots FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='snapshots' AND policyname='snap_insert') THEN
    CREATE POLICY "snap_insert" ON public.snapshots FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='snapshots' AND policyname='snap_delete') THEN
    CREATE POLICY "snap_delete" ON public.snapshots FOR DELETE TO authenticated USING (public.current_user_role() = 'admin');
  END IF;
END $$;

-- ── change_log ───────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='change_log' AND policyname='log_select') THEN
    CREATE POLICY "log_select" ON public.change_log FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='change_log' AND policyname='log_delete') THEN
    CREATE POLICY "log_delete" ON public.change_log FOR DELETE TO authenticated USING (public.current_user_role() = 'admin');
  END IF;
END $$;

-- ── app_config ───────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_config' AND policyname='cfg_select') THEN
    CREATE POLICY "cfg_select" ON public.app_config FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_config' AND policyname='cfg_write') THEN
    CREATE POLICY "cfg_write" ON public.app_config FOR ALL TO authenticated
      USING (public.current_user_role() = 'admin')
      WITH CHECK (public.current_user_role() = 'admin');
  END IF;
END $$;

-- ── user_metadata ────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_metadata' AND policyname='meta_select') THEN
    CREATE POLICY "meta_select" ON public.user_metadata FOR SELECT TO authenticated
      USING (id = auth.uid() OR public.current_user_role() = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_metadata' AND policyname='meta_update') THEN
    CREATE POLICY "meta_update" ON public.user_metadata FOR UPDATE TO authenticated
      USING (id = auth.uid() OR public.current_user_role() = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_metadata' AND policyname='meta_insert') THEN
    CREATE POLICY "meta_insert" ON public.user_metadata FOR INSERT TO authenticated
      WITH CHECK (public.current_user_role() = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_metadata' AND policyname='meta_delete') THEN
    CREATE POLICY "meta_delete" ON public.user_metadata FOR DELETE TO authenticated
      USING (public.current_user_role() = 'admin');
  END IF;
END $$;

-- ── user_profiles ────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='prof_select') THEN
    CREATE POLICY "prof_select" ON public.user_profiles FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='prof_admin') THEN
    CREATE POLICY "prof_admin" ON public.user_profiles FOR ALL TO authenticated
      USING (public.current_user_role() = 'admin')
      WITH CHECK (public.current_user_role() = 'admin');
  END IF;
END $$;


-- ============================================================
-- REALTIME (idempotent)
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['activities','pds_entries','risks','snapshots'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.' || quote_ident(t);
    END IF;
  END LOOP;
END;
$$;
