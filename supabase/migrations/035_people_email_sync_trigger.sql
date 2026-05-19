-- Auto-sync people.email when profiles.email changes.
-- Covers all email-change paths: admin Edge Function, self-edit, and future flows.
CREATE OR REPLACE FUNCTION sync_people_email_from_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE people
    SET email = NEW.email
    WHERE profile_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_people_email ON profiles;
CREATE TRIGGER sync_people_email
  AFTER UPDATE OF email ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_people_email_from_profile();

COMMENT ON FUNCTION sync_people_email_from_profile() IS
  'Auto-syncs people.email when profiles.email changes (covers admin-side and self-edit flows).';
