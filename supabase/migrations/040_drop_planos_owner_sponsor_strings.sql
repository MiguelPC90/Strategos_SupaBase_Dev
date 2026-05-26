-- Migration 040: drop legacy owner / sponsor string columns from planos.
-- The FK-based columns (owner_person_ids, owner_primary_id, owner_label_override,
-- sponsor_person_ids, sponsor_primary_id, sponsor_label_override) are the source
-- of truth as of commit 3 of the Phase 13.12 owner/sponsor refactor.
-- Apply this AFTER deploying the frontend (commit 3) and smoke-testing.

BEGIN;

ALTER TABLE planos
  DROP COLUMN IF EXISTS owner,
  DROP COLUMN IF EXISTS sponsor;

COMMIT;
