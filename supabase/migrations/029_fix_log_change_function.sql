-- ─────────────────────────────────────────────────────────────
-- 029 — Fix log_change trigger function
-- ─────────────────────────────────────────────────────────────
-- The previous version of log_change() read NEW.updated_by and
-- OLD.updated_by, but the eixos and planos tables do not have
-- an `updated_by` column. Any INSERT/UPDATE/DELETE on those
-- tables failed with error 42703:
--   record "new" has no field "updated_by"
--
-- Fix: capture the current user via auth.uid() instead of
-- relying on a per-table column. This makes the trigger
-- uniform across all 12 audited tables, removes the need for
-- the frontend to send updated_by, and aligns with Supabase
-- auth-context conventions.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.change_log
    (table_name, record_id, operation, changed_by, old_values, new_values)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;
