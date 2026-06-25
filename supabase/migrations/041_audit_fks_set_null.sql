-- Migration 041: audit FKs to auth.users -> ON DELETE SET NULL
--
-- Context: applied MANUALLY via the Supabase Dashboard during the user-delete security fix
-- (June 2026). This file versions that change for reproducibility on fresh environments.
-- In production it is ALREADY applied (verified: all 11 constraints have confdeltype='n').
--
-- !! DO NOT run this against production. It is already applied. Run only on a fresh/clean
-- !! environment that needs these constraints created. The DROP+ADD inside the transaction
-- !! briefly removes each FK; harmless on an empty/fresh DB, undesirable on a live one.
--
-- Why: these 11 audit columns reference auth.users(id) and were previously NO ACTION, which
-- BLOCKED auth.admin.deleteUser for any user that had authored audited rows (error 23503),
-- leaving a half-deleted user. SET NULL nulls the audit reference on delete while preserving
-- the audited row.
--
-- Constraint names verified against pg_constraint on 2026-06-25. NOTE three fin_* tables use
-- legacy PT constraint names (fin_rubricas/fin_contratos/fin_facturas), not the EN table name.

-- VERIFICATION (run first on the target; expect 11 rows, confdeltype 'n' once applied):
-- SELECT conrelid::regclass AS tabela, conname, confdeltype
-- FROM pg_constraint
-- WHERE contype='f' AND confrelid='auth.users'::regclass
--   AND conrelid::regclass::text IN ('activities','app_config','change_log','fin_budget_lines',
--       'fin_contracts','fin_invoices','fte_resources','pds_entries','people','risks','snapshots')
-- ORDER BY tabela;

BEGIN;

ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_updated_by_fkey;
ALTER TABLE public.activities ADD CONSTRAINT activities_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.app_config DROP CONSTRAINT IF EXISTS app_config_updated_by_fkey;
ALTER TABLE public.app_config ADD CONSTRAINT app_config_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.change_log DROP CONSTRAINT IF EXISTS change_log_changed_by_fkey;
ALTER TABLE public.change_log ADD CONSTRAINT change_log_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fin_budget_lines DROP CONSTRAINT IF EXISTS fin_rubricas_updated_by_fkey;
ALTER TABLE public.fin_budget_lines ADD CONSTRAINT fin_rubricas_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fin_contracts DROP CONSTRAINT IF EXISTS fin_contratos_updated_by_fkey;
ALTER TABLE public.fin_contracts ADD CONSTRAINT fin_contratos_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fin_invoices DROP CONSTRAINT IF EXISTS fin_facturas_updated_by_fkey;
ALTER TABLE public.fin_invoices ADD CONSTRAINT fin_facturas_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fte_resources DROP CONSTRAINT IF EXISTS fte_resources_updated_by_fkey;
ALTER TABLE public.fte_resources ADD CONSTRAINT fte_resources_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pds_entries DROP CONSTRAINT IF EXISTS pds_entries_updated_by_fkey;
ALTER TABLE public.pds_entries ADD CONSTRAINT pds_entries_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_updated_by_fkey;
ALTER TABLE public.people ADD CONSTRAINT people_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.risks DROP CONSTRAINT IF EXISTS risks_updated_by_fkey;
ALTER TABLE public.risks ADD CONSTRAINT risks_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.snapshots DROP CONSTRAINT IF EXISTS snapshots_created_by_fkey;
ALTER TABLE public.snapshots ADD CONSTRAINT snapshots_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
