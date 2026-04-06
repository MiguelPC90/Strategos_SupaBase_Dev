-- Migration 004: Catálogo de Pessoas
-- Registo central de pessoas para cruzamento de alocações entre projectos.
-- O campo nome é a chave de ligação com fte_recursos.nome (sem FK, para backwards compat).

CREATE TABLE IF NOT EXISTS pessoas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  email      text        DEFAULT '',
  unidade    text        DEFAULT '',
  perfil     text        DEFAULT '',
  tipo       text        DEFAULT 'interno',   -- 'interno' | 'externo'
  notas      text        DEFAULT '',
  activo     boolean     DEFAULT true,
  sort_order integer     DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Nome único (case-insensitive, sem espaços extra)
CREATE UNIQUE INDEX IF NOT EXISTS pessoas_nome_unique ON pessoas (lower(trim(nome)));
CREATE INDEX IF NOT EXISTS pessoas_activo_idx ON pessoas (activo);

-- Auto-update updated_at (reutiliza a função set_updated_at() do schema base)
CREATE TRIGGER pessoas_updated_at
  BEFORE UPDATE ON pessoas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row Level Security
ALTER TABLE pessoas ENABLE ROW LEVEL SECURITY;

-- Todos os utilizadores autenticados podem ler
CREATE POLICY "pess_select" ON pessoas
  FOR SELECT TO authenticated USING (true);

-- Editor e admin podem criar e actualizar
CREATE POLICY "pess_insert" ON pessoas
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('editor', 'admin'));

CREATE POLICY "pess_update" ON pessoas
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('editor', 'admin'));

-- Só admin pode eliminar
CREATE POLICY "pess_delete" ON pessoas
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');
