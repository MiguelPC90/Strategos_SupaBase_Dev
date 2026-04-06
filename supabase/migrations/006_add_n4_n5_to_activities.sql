-- Migration 006: Add n4 and n5 hierarchy columns to activities
-- Extends Gantt/activity hierarchy from 4 levels to 6 levels.
-- Safe to run multiple times (uses IF NOT EXISTS).

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS n4 TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS n5 TEXT NOT NULL DEFAULT '';
