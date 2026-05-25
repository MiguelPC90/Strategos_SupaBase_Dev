-- Migration 037: sort_order per-parent for programs, eixos, planos, and activities
--
-- Wave 4 — Hierarchical natural sort (sub-wave 4a)
--
-- Problem: sort_order was being assigned globally (or as 0 by default), causing
-- collisions when multiple records shared the same parent. NovoPlanoModal and
-- DuplicatePlanoModal computed max(sort_order) + 1 globally instead of per
-- eixo_id. Admin created programs/eixos with sort_order: 0.
--
-- Fix: re-number sort_order using ROW_NUMBER() partitioned by parent, ordering
-- by numeric code first (when applicable), then text code, then created_at.
-- This preserves relative order where it was meaningful while ensuring every
-- (parent, sort_order) pair is unique.
--
-- Idempotency: re-running this migration produces the same result given the
-- same data. Safe to apply multiple times.
--
-- Frontend fixes that prevent the bug from recurring after creation are
-- delivered in sub-wave 4b (this same commit).
--
-- Applied via Supabase Dashboard SQL Editor (macOS 11 limitation prevents
-- Supabase CLI usage — see CLAUDE.md → Known Issues).


-- ── Part 1/4: programs ───────────────────────────────────────────────
-- Linear renumbering. No hierarchy above.
WITH renumbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN code ~ '^[0-9]+$' THEN code::int END NULLS LAST,
        code,
        created_at ASC,
        id ASC
    ) AS new_order
  FROM programs
)
UPDATE programs p
SET sort_order = r.new_order
FROM renumbered r
WHERE p.id = r.id;


-- ── Part 2/4: eixos (partitioned by program_id) ──────────────────────
WITH renumbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY program_id
      ORDER BY
        CASE WHEN code ~ '^[0-9]+$' THEN code::int END NULLS LAST,
        code,
        created_at ASC,
        id ASC
    ) AS new_order
  FROM eixos
)
UPDATE eixos e
SET sort_order = r.new_order
FROM renumbered r
WHERE e.id = r.id;


-- ── Part 3/4: planos (partitioned by eixo_id) ────────────────────────
WITH renumbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY eixo_id
      ORDER BY
        CASE WHEN code ~ '^[0-9]+$' THEN code::int END NULLS LAST,
        code,
        created_at ASC,
        id ASC
    ) AS new_order
  FROM planos
)
UPDATE planos p
SET sort_order = r.new_order
FROM renumbered r
WHERE p.id = r.id;


-- ── Part 4/4: activities (partitioned by plano_id + level) ───────────
-- Activities of different levels can share a plano_id, hence the composite
-- partition. Orphan activities (plano_id NULL — should not exist) get a
-- single bucket via COALESCE fallback. Activities have no `code` field, so
-- the ordering uses the existing sort_order + created_at + id chain to
-- preserve relative order.
WITH renumbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(plano_id::text, '__orphan__'), level
      ORDER BY sort_order ASC, created_at ASC, id ASC
    ) AS new_order
  FROM activities
)
UPDATE activities a
SET sort_order = r.new_order
FROM renumbered r
WHERE a.id = r.id;


-- ── Verification queries (commented out — uncomment to run after) ────
--
-- Confirm zero collisions across all 4 tables:
--
-- SELECT 'planos collisions' AS tbl, COUNT(*) AS count
-- FROM (SELECT eixo_id, sort_order FROM planos
--       GROUP BY eixo_id, sort_order HAVING COUNT(*) > 1) s
-- UNION ALL SELECT 'eixos collisions', COUNT(*)
-- FROM (SELECT program_id, sort_order FROM eixos
--       GROUP BY program_id, sort_order HAVING COUNT(*) > 1) s
-- UNION ALL SELECT 'programs collisions', COUNT(*)
-- FROM (SELECT sort_order FROM programs
--       GROUP BY sort_order HAVING COUNT(*) > 1) s
-- UNION ALL SELECT 'activities collisions', COUNT(*)
-- FROM (SELECT plano_id, level, sort_order FROM activities
--       GROUP BY plano_id, level, sort_order HAVING COUNT(*) > 1) s;
--
-- Expected: 0 rows for each.
