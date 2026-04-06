-- ============================================================
-- Migração 001: Adicionar coluna n0s à tabela user_profiles
-- Executar no SQL Editor do Supabase
-- ============================================================

-- Adicionar coluna n0s (array de programas permitidos)
-- Vazio ([]) = sem restrição = acesso a todos os programas
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS n0s JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Comentário explicativo
COMMENT ON COLUMN public.user_profiles.n0s IS
  'Lista de N0 (programas) acessíveis por este perfil. Vazio = acesso a todos.';
