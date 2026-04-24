-- Migration 020: Fix page key mismatch for Execução Financeira
-- Renames stored permission rows from the wrong key to the correct one.
-- Idempotent: safe to re-run (UPDATE on already-renamed rows matches 0 rows).

UPDATE public.user_permissions
SET page = 'exec-financeira'
WHERE page = 'execucao-financeira';
