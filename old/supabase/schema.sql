-- ============================================================
-- Strategos PMO — Supabase Schema (idempotente — pode re-correr)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PERFIS DE PERMISSÃO ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  tabs       JSONB NOT NULL DEFAULT '{}'::jsonb,
  n0s        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Adicionar coluna n0s se a tabela já existia sem ela
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS n0s JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── 2. METADADOS DE UTILIZADOR ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_metadata (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  profile_id   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  role         TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('admin','editor','viewer')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. ACTIVIDADES & GANTT ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activities (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source     TEXT NOT NULL CHECK (source IN ('act','gantt')),
  nivel      INTEGER NOT NULL,
  nome       TEXT NOT NULL DEFAULT '',
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
  status     TEXT NOT NULL DEFAULT 'Em dia',
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
CREATE INDEX IF NOT EXISTS idx_activities_nivel   ON public.activities(nivel);

-- ── 4. ENTRADAS PDS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pds_entries (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id0                TEXT NOT NULL DEFAULT '1',
  id1                TEXT NOT NULL DEFAULT '',
  id2                TEXT NOT NULL DEFAULT '',
  plano              TEXT NOT NULL DEFAULT '',
  n0                 TEXT NOT NULL DEFAULT '',
  n1                 TEXT NOT NULL DEFAULT '',
  compromissos_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  avancos_items      JSONB NOT NULL DEFAULT '[]'::jsonb,
  proximos_items     JSONB NOT NULL DEFAULT '[]'::jsonb,
  atencao_items      JSONB NOT NULL DEFAULT '[]'::jsonb,
  compromissos       TEXT,
  avancos            TEXT,
  proximos           TEXT,
  atencao            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         UUID REFERENCES auth.users(id),
  UNIQUE(id0, id2)
);

CREATE INDEX IF NOT EXISTS idx_pds_id0_id2 ON public.pds_entries(id0, id2);
CREATE INDEX IF NOT EXISTS idx_pds_n0_n1   ON public.pds_entries(n0, n1);

-- ── 5. RISCOS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.risks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id      UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  impact      INTEGER NOT NULL DEFAULT 1 CHECK (impact BETWEEN 1 AND 5),
  prob        INTEGER NOT NULL DEFAULT 1 CHECK (prob BETWEEN 1 AND 5),
  status      TEXT NOT NULL DEFAULT 'Aberto',
  mitigation  TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_risks_pds_id ON public.risks(pds_id);

-- ── 6. FINANÇAS — RUBRICAS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_rubricas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id     UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  app_id     TEXT NOT NULL DEFAULT '',
  categoria  TEXT NOT NULL DEFAULT '',
  capex      BOOLEAN NOT NULL DEFAULT false,
  moeda      TEXT NOT NULL DEFAULT '€',
  valores    JSONB NOT NULL DEFAULT '{}'::jsonb,
  nota       TEXT,
  fonte      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fin_rubricas_pds_id ON public.fin_rubricas(pds_id);

-- ── 7. FINANÇAS — CONTRATOS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_contratos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id      UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  app_id      TEXT NOT NULL DEFAULT '',
  fornecedor  TEXT NOT NULL DEFAULT '',
  categoria   TEXT NOT NULL DEFAULT '',
  moeda       TEXT NOT NULL DEFAULT '€',
  cambio_ref  NUMERIC,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  data_adj    DATE,
  descricao   TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fin_contratos_pds_id ON public.fin_contratos(pds_id);

-- ── 8. FINANÇAS — FACTURAS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_facturas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id          UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  contrato_id     UUID REFERENCES public.fin_contratos(id) ON DELETE SET NULL,
  app_id          TEXT NOT NULL DEFAULT '',
  app_contrato_id TEXT NOT NULL DEFAULT '',
  ref             TEXT NOT NULL DEFAULT '',
  fornecedor      TEXT NOT NULL DEFAULT '',
  doc_tipo        TEXT,
  descricao       TEXT,
  valor           NUMERIC NOT NULL DEFAULT 0,
  moeda           TEXT NOT NULL DEFAULT '€',
  cambio          NUMERIC,
  data_emissao    DATE,
  data_vencimento DATE,
  data_pagamento  DATE,
  estado          TEXT NOT NULL DEFAULT 'Por facturar',
  memorando       TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fin_facturas_pds_id      ON public.fin_facturas(pds_id);
CREATE INDEX IF NOT EXISTS idx_fin_facturas_contrato_id ON public.fin_facturas(contrato_id);

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

-- ── 10. HISTÓRICO DE ALTERAÇÕES ──────────────────────────────
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

-- ── 11. CONFIGURAÇÃO DA APP ──────────────────────────────────
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
-- TRIGGERS: updated_at automático (idempotente)
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
    'fin_rubricas','fin_contratos','fin_facturas','app_config'
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
-- TRIGGER: change_log automático (idempotente)
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
    'fin_rubricas','fin_contratos','fin_facturas'
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

ALTER TABLE public.user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_metadata   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pds_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_rubricas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_contratos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_facturas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config      ENABLE ROW LEVEL SECURITY;

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

-- ── fin_rubricas ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_rubricas' AND policyname='rub_select') THEN
    CREATE POLICY "rub_select" ON public.fin_rubricas FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_rubricas' AND policyname='rub_insert') THEN
    CREATE POLICY "rub_insert" ON public.fin_rubricas FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_rubricas' AND policyname='rub_update') THEN
    CREATE POLICY "rub_update" ON public.fin_rubricas FOR UPDATE TO authenticated USING (true) WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_rubricas' AND policyname='rub_delete') THEN
    CREATE POLICY "rub_delete" ON public.fin_rubricas FOR DELETE TO authenticated USING (public.current_user_role() IN ('editor','admin'));
  END IF;
END $$;

-- ── fin_contratos ────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_contratos' AND policyname='cnt_select') THEN
    CREATE POLICY "cnt_select" ON public.fin_contratos FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_contratos' AND policyname='cnt_insert') THEN
    CREATE POLICY "cnt_insert" ON public.fin_contratos FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_contratos' AND policyname='cnt_update') THEN
    CREATE POLICY "cnt_update" ON public.fin_contratos FOR UPDATE TO authenticated USING (true) WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_contratos' AND policyname='cnt_delete') THEN
    CREATE POLICY "cnt_delete" ON public.fin_contratos FOR DELETE TO authenticated USING (public.current_user_role() IN ('editor','admin'));
  END IF;
END $$;

-- ── fin_facturas ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_facturas' AND policyname='fat_select') THEN
    CREATE POLICY "fat_select" ON public.fin_facturas FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_facturas' AND policyname='fat_insert') THEN
    CREATE POLICY "fat_insert" ON public.fin_facturas FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_facturas' AND policyname='fat_update') THEN
    CREATE POLICY "fat_update" ON public.fin_facturas FOR UPDATE TO authenticated USING (true) WITH CHECK (public.current_user_role() IN ('editor','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fin_facturas' AND policyname='fat_delete') THEN
    CREATE POLICY "fat_delete" ON public.fin_facturas FOR DELETE TO authenticated USING (public.current_user_role() IN ('editor','admin'));
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
-- REALTIME (idempotente)
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
