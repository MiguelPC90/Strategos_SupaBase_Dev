-- ── Legacy Resources Table (v1 — hour-based allocation per project) ──────────
-- Superseded by fte_resources (migration 003). Keep for backwards compatibility.

CREATE TABLE IF NOT EXISTS resources (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id0              text NOT NULL,
  id1              text,
  id2              text,
  name             text NOT NULL,
  org_unit         text,
  role             text,
  total_hours      numeric(8,2) DEFAULT 0,
  project_hours    numeric(8,2) DEFAULT 0,
  period_start     date,
  period_end       date,
  hourly_cost      numeric(10,2),
  notes            text,
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
