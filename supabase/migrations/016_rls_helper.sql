-- Migration 016: RLS helper function for program access

CREATE OR REPLACE FUNCTION public.user_has_program_access(p_program_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin always sees everything
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User with NO permissions sees everything (backwards compat with usePermissions)
    NOT EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid()
    )
    OR
    -- User has explicit permission to this program
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid()
      AND program_id = p_program_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_program_access(UUID) TO authenticated;
