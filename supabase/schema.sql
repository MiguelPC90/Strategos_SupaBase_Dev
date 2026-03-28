-- ============================================================
-- Strategos PMO — Supabase Schema
-- Executar no SQL Editor do Supabase (Schema tab)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PERFIS DE PERMISSÃO (não confundir com auth.users) ───
CREATE TABLE public.user_profiles (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  tabs       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. METADADOS DE UTILIZADOR (mapeia auth.users → perfil) ─
CREATE TABLE public.user_metadata (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  profile_id   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  role         TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('admin','editor','viewer')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. ACTIVIDADES & GANTT (tabela unificada) ───────────────
-- source = 'act' | 'gantt'
-- Hierarquia: nivel (0-6), n0/n1/n2/n3, id0/id1/id2
CREATE TABLE public.activities (
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

CREATE INDEX idx_activities_source  ON public.activities(source);
CREATE INDEX idx_activities_n0_n1   ON public.activities(n0, n1);
CREATE INDEX idx_activities_id0_id2 ON public.activities(id0, id2);
CREATE INDEX idx_activities_nivel   ON public.activities(nivel);

-- ── 4. ENTRADAS PDS ──────────────────────────────────────────
-- Um registo por plano de acção (id0 + id2)
-- Arrays de items guardados em JSONB para simplicidade
CREATE TABLE public.pds_entries (
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
  -- Campos legados de texto (compatibilidade com exportação Excel)
  compromissos       TEXT,
  avancos            TEXT,
  proximos           TEXT,
  atencao            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         UUID REFERENCES auth.users(id),
  UNIQUE(id0, id2)
);

CREATE INDEX idx_pds_id0_id2 ON public.pds_entries(id0, id2);
CREATE INDEX idx_pds_n0_n1   ON public.pds_entries(n0, n1);

-- ── 5. RISCOS (filho de pds_entries) ────────────────────────
CREATE TABLE public.risks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id     UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  impact     INTEGER NOT NULL DEFAULT 1 CHECK (impact BETWEEN 1 AND 5),
  prob       INTEGER NOT NULL DEFAULT 1 CHECK (prob BETWEEN 1 AND 5),
  status     TEXT NOT NULL DEFAULT 'Aberto',
  mitigation TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_risks_pds_id ON public.risks(pds_id);

-- ── 6. FINANÇAS — RUBRICAS (linhas orçamentais) ─────────────
CREATE TABLE public.fin_rubricas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id     UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  app_id     TEXT NOT NULL DEFAULT '',   -- uid() original da app
  categoria  TEXT NOT NULL DEFAULT '',
  capex      BOOLEAN NOT NULL DEFAULT false,
  moeda      TEXT NOT NULL DEFAULT '€',
  valores    JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"2025": 10000, "2026": 5000}
  nota       TEXT,
  fonte      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_fin_rubricas_pds_id ON public.fin_rubricas(pds_id);

-- ── 7. FINANÇAS — CONTRATOS ──────────────────────────────────
CREATE TABLE public.fin_contratos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id      UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  app_id      TEXT NOT NULL DEFAULT '',   -- uid() original da app
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

CREATE INDEX idx_fin_contratos_pds_id ON public.fin_contratos(pds_id);

-- ── 8. FINANÇAS — FACTURAS ───────────────────────────────────
CREATE TABLE public.fin_facturas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pds_id          UUID NOT NULL REFERENCES public.pds_entries(id) ON DELETE CASCADE,
  contrato_id     UUID REFERENCES public.fin_contratos(id) ON DELETE SET NULL,
  app_id          TEXT NOT NULL DEFAULT '',    -- uid() original da app
  app_contrato_id TEXT NOT NULL DEFAULT '',    -- contrato app_id de referência
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

CREATE INDEX idx_fin_facturas_pds_id     ON public.fin_facturas(pds_id);
CREATE INDEX idx_fin_facturas_contrato_id ON public.fin_facturas(contrato_id);

-- ── 9. SNAPSHOTS DE EVOLUÇÃO ────────────────────────────────
CREATE TABLE public.snapshots (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label      TEXT NOT NULL,
  snap_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
  kpi        JSONB NOT NULL DEFAULT '{}'::jsonb,
  by_n1      JSONB NOT NULL DEFAULT '{}'::jsonb,
  by_n0      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_snapshots_date ON public.snapshots(snap_date DESC);

-- ── 10. HISTÓRICO DE ALTERAÇÕES (audit trail) ───────────────
CREATE TABLE public.change_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id  UUID NOT NULL,
  operation  TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_values JSONB,
  new_values JSONB,
  summary    TEXT  -- legível: "pct alterado 45 → 67 em Actividade 1.2.3"
);

CREATE INDEX idx_change_log_record     ON public.change_log(record_id);
CREATE INDEX idx_change_log_table      ON public.change_log(table_name);
CREATE INDEX idx_change_log_changed_at ON public.change_log(changed_at DESC);
CREATE INDEX idx_change_log_user       ON public.change_log(changed_by);

-- ── 11. CONFIGURAÇÃO DA APP (blob CFG) ───────────────────────
-- Uma única linha identificada por config_key = 'main'
CREATE TABLE public.app_config (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT UNIQUE NOT NULL DEFAULT 'main',
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Linha padrão
INSERT INTO public.app_config (config_key, data)
VALUES ('main', '{}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;


-- ============================================================
-- TRIGGERS: updated_at automático
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
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;


-- ============================================================
-- TRIGGER: change_log automático
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
    EXECUTE format(
      'CREATE TRIGGER trg_%I_log
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.log_change()',
      t, t
    );
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

-- Função auxiliar: obter role do utilizador actual
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.user_metadata WHERE id = auth.uid();
$$;

-- ── Tabelas de dados (activities, pds_entries, risks, finances, snapshots) ──
-- Padrão: qualquer autenticado lê; editor/admin escreve; só admin apaga

-- activities
CREATE POLICY "act_select" ON public.activities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "act_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "act_update" ON public.activities
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "act_delete" ON public.activities
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- pds_entries
CREATE POLICY "pds_select" ON public.pds_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pds_insert" ON public.pds_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "pds_update" ON public.pds_entries
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "pds_delete" ON public.pds_entries
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- risks
CREATE POLICY "risk_select" ON public.risks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "risk_insert" ON public.risks
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "risk_update" ON public.risks
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "risk_delete" ON public.risks
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('editor','admin'));

-- fin_rubricas
CREATE POLICY "rub_select" ON public.fin_rubricas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rub_insert" ON public.fin_rubricas
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "rub_update" ON public.fin_rubricas
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "rub_delete" ON public.fin_rubricas
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('editor','admin'));

-- fin_contratos
CREATE POLICY "cnt_select" ON public.fin_contratos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cnt_insert" ON public.fin_contratos
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "cnt_update" ON public.fin_contratos
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "cnt_delete" ON public.fin_contratos
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('editor','admin'));

-- fin_facturas
CREATE POLICY "fat_select" ON public.fin_facturas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fat_insert" ON public.fin_facturas
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "fat_update" ON public.fin_facturas
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "fat_delete" ON public.fin_facturas
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('editor','admin'));

-- snapshots
CREATE POLICY "snap_select" ON public.snapshots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "snap_insert" ON public.snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('editor','admin'));
CREATE POLICY "snap_delete" ON public.snapshots
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- ── change_log: leitura para todos os autenticados, só admin apaga ──
CREATE POLICY "log_select" ON public.change_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "log_delete" ON public.change_log
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- ── app_config: leitura para todos; só admin escreve ────────
CREATE POLICY "cfg_select" ON public.app_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cfg_write" ON public.app_config
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ── user_metadata: cada um vê o seu; admin vê tudo ──────────
CREATE POLICY "meta_select" ON public.user_metadata
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_user_role() = 'admin');
CREATE POLICY "meta_update" ON public.user_metadata
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.current_user_role() = 'admin');
CREATE POLICY "meta_insert" ON public.user_metadata
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "meta_delete" ON public.user_metadata
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- ── user_profiles: todos lêem; só admin gere ────────────────
CREATE POLICY "prof_select" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "prof_admin" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');


-- ============================================================
-- REALTIME: activar para tabelas colaborativas
-- (executar no dashboard Supabase → Database → Replication)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.pds_entries;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.risks;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.fin_rubricas;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.fin_contratos;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.fin_facturas;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.snapshots;
-- ============================================================
