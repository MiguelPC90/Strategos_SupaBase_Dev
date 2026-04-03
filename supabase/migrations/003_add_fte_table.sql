-- ── Gestão de Recursos FTE ────────────────────────────────────────────────────
-- Tabela de recursos humanos por plano de acção (pds_entry)
-- Substitui a tabela `resources` (v1, baseada em id0/horas)

CREATE TABLE IF NOT EXISTS fte_recursos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pds_id       uuid NOT NULL REFERENCES pds_entries(id) ON DELETE CASCADE,
  app_id       text        NOT NULL DEFAULT '',  -- ID gerado pela app (uid())
  nome         text        NOT NULL DEFAULT '',
  unidade      text                 DEFAULT '',
  perfil       text                 DEFAULT '',
  tipo         text                 DEFAULT 'interno', -- interno | externo
  custo_dia    numeric(10,2)        DEFAULT 0,
  id2          text                 DEFAULT '',  -- projecto (N2)
  data_inicio  date,
  data_fim     date,
  alocacao_pct numeric(5,1)         DEFAULT 100, -- % alocação (100 = 1 FTE)
  contrato_id  text                 DEFAULT '',  -- ref a fin_contratos.app_id
  estado       text                 DEFAULT 'activo', -- activo | inactivo
  sort_order   integer              DEFAULT 0,
  updated_at   timestamptz          DEFAULT now(),
  updated_by   uuid REFERENCES auth.users(id)
);

ALTER TABLE fte_recursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read fte_recursos"
  ON fte_recursos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editor insert fte_recursos"
  ON fte_recursos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Editor update fte_recursos"
  ON fte_recursos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Editor delete fte_recursos"
  ON fte_recursos FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS fte_recursos_pds_id_idx ON fte_recursos(pds_id);

CREATE TRIGGER fte_recursos_updated_at
  BEFORE UPDATE ON fte_recursos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- dias_úteis por mês configurável por plano
ALTER TABLE pds_entries
  ADD COLUMN IF NOT EXISTS fte_dias_uteis smallint DEFAULT 22;
