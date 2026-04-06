-- ── Gestão de Recursos Humanos/Esforço ──────────────────────────────────────
-- Tabela para gerir alocação de recursos humanos por projecto (N2)

CREATE TABLE IF NOT EXISTS resources (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id0              text NOT NULL,              -- plano / programa (n0)
  id1              text,                       -- sub-programa (n1) opcional
  id2              text,                       -- projecto (n2)
  nome             text NOT NULL,
  unidade          text,
  perfil           text,
  alocacao_total   numeric(8,2) DEFAULT 0,     -- horas totais disponíveis
  alocacao_projeto numeric(8,2) DEFAULT 0,     -- horas alocadas ao projecto
  periodo_inicio   date,
  periodo_fim      date,
  custo_hora       numeric(10,2),
  notas            text,
  sort_order       integer DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  updated_by       uuid REFERENCES auth.users(id)
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read resources"
  ON resources FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editor insert resources"
  ON resources FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Editor update resources"
  ON resources FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Editor delete resources"
  ON resources FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS resources_id0_idx ON resources(id0);
CREATE INDEX IF NOT EXISTS resources_id2_idx ON resources(id2);

CREATE TRIGGER resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
