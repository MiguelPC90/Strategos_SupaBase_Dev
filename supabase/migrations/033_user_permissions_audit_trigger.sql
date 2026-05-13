-- Migration 033: Add audit trigger to user_permissions
-- Ensures changes to permission grants/revocations appear in change_log.
-- The log_change() function already exists (029); we just attach the trigger.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_user_permissions_log'
      AND tgrelid = 'public.user_permissions'::regclass
  ) THEN
    CREATE TRIGGER trg_user_permissions_log
      AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
      FOR EACH ROW EXECUTE FUNCTION public.log_change();
  END IF;
END $$;
