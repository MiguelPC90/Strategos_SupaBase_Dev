-- ── FTE Resources Table ───────────────────────────────────────────────────────
-- Per-plan human resource allocation (replaces legacy `resources` table).

CREATE TABLE IF NOT EXISTS fte_resources (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pds_id         uuid NOT NULL REFERENCES pds_entries(id) ON DELETE CASCADE,
  app_id         text        NOT NULL DEFAULT '',   -- client-side uid()
  name           text        NOT NULL DEFAULT '',
  org_unit       text                 DEFAULT '',
  role           text                 DEFAULT '',
  type           text                 DEFAULT 'internal',  -- internal | external
  daily_cost     numeric(10,2)        DEFAULT 0,
  id2            text                 DEFAULT '',          -- project ref (N2)
  start_date     date,
  end_date       date,
  allocation_pct numeric(5,1)         DEFAULT 100,         -- 100 = 1 FTE
  contract_id    text                 DEFAULT '',          -- ref to fin_contracts.app_id
  status         text                 DEFAULT 'active',    -- active | inactive
  sort_order     integer              DEFAULT 0,
  updated_at     timestamptz          DEFAULT now(),
  updated_by     uuid REFERENCES auth.users(id)
);

ALTER TABLE fte_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read fte_resources"
  ON fte_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editor insert fte_resources"
  ON fte_resources FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Editor update fte_resources"
  ON fte_resources FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Editor delete fte_resources"
  ON fte_resources FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS fte_resources_pds_id_idx ON fte_resources(pds_id);

CREATE TRIGGER fte_resources_updated_at
  BEFORE UPDATE ON fte_resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- FTE working days per month configurable per plan
ALTER TABLE pds_entries
  ADD COLUMN IF NOT EXISTS fte_working_days smallint DEFAULT 22;
