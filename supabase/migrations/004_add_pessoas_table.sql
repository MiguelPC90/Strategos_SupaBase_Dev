-- Migration 004: People Catalogue
-- Central registry of people for cross-project allocation analysis.
-- The `name` field is the linking key with fte_resources.name (no FK, for backwards compat).

CREATE TABLE IF NOT EXISTS people (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text        DEFAULT '',
  org_unit   text        DEFAULT '',
  role       text        DEFAULT '',
  type       text        DEFAULT 'internal',  -- 'internal' | 'external'
  notes      text        DEFAULT '',
  active     boolean     DEFAULT true,
  sort_order integer     DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Unique name (case-insensitive, trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS people_name_unique ON people (lower(trim(name)));
CREATE INDEX IF NOT EXISTS people_active_idx ON people (active);

-- Auto-update updated_at
CREATE TRIGGER people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row Level Security
ALTER TABLE people ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "people_select" ON people
  FOR SELECT TO authenticated USING (true);

-- Editor and admin can create and update
CREATE POLICY "people_insert" ON people
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('editor', 'admin'));

CREATE POLICY "people_update" ON people
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('editor', 'admin'));

-- Only admin can delete
CREATE POLICY "people_delete" ON people
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');
