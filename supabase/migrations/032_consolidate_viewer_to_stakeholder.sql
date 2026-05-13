-- 032 — Consolidate 'viewer' role into 'stakeholder'
-- Migration 024 already removed 'viewer' from the profiles CHECK constraint.
-- This UPDATE migrates any remaining rows (expected 0 in production).
UPDATE public.profiles
SET role = 'stakeholder'
WHERE role = 'viewer';
