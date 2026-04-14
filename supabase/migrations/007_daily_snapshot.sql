-- Migration 007: daily_snapshot() — use program/eixo UUIDs as keys
--
-- Fixes by_n0 and by_n1 to use UUIDs instead of names.
-- Run this in the Supabase SQL Editor to replace the previous function.
--
-- Changes:
--   by_n0 keys: activities.program_id (UUID) — was programs.name / n0 (text)
--   by_n1 keys: eixos.id (UUID) joined via e.name = a.n1 — was a.n1 (text)

CREATE OR REPLACE FUNCTION public.daily_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kpi   jsonb;
  v_by_n0 jsonb;
  v_by_n1 jsonb;
BEGIN

  -- ── Overall KPI (all activities) ──────────────────────────────
  SELECT jsonb_build_object(
    'total',      COUNT(*),
    'concluidas', COUNT(*) FILTER (WHERE pct >= 100),
    'em_dia',     COUNT(*) FILTER (WHERE pct < 100 AND status = 'Em dia'),
    'em_atraso',  COUNT(*) FILTER (WHERE pct < 100 AND status IN ('Em atraso', 'atrasada')),
    'exec_media', COALESCE(AVG(pct), 0)
  )
  INTO v_kpi
  FROM public.activities;

  -- ── by_n0: KPIs keyed by program UUID ─────────────────────────
  -- Only includes activities that have a program_id set.
  -- Legacy activities (program_id IS NULL) are excluded here;
  -- they are still counted in the overall v_kpi above.
  SELECT COALESCE(jsonb_object_agg(program_id::text, kpi), '{}'::jsonb)
  INTO v_by_n0
  FROM (
    SELECT
      a.program_id,
      jsonb_build_object(
        'total',      COUNT(*),
        'concluidas', COUNT(*) FILTER (WHERE a.pct >= 100),
        'em_dia',     COUNT(*) FILTER (WHERE a.pct < 100 AND a.status = 'Em dia'),
        'em_atraso',  COUNT(*) FILTER (WHERE a.pct < 100 AND a.status IN ('Em atraso', 'atrasada')),
        'exec_media', COALESCE(AVG(a.pct), 0)
      ) AS kpi
    FROM public.activities a
    WHERE a.program_id IS NOT NULL
    GROUP BY a.program_id
  ) sub;

  -- ── by_n1: KPIs keyed by eixo UUID ────────────────────────────
  -- Joins eixos on name (a.n1) + program_id to resolve the UUID.
  -- Activities without n1 or without a matching eixo row are excluded.
  SELECT COALESCE(jsonb_object_agg(eixo_id::text, kpi), '{}'::jsonb)
  INTO v_by_n1
  FROM (
    SELECT
      e.id AS eixo_id,
      jsonb_build_object(
        'total',      COUNT(*),
        'concluidas', COUNT(*) FILTER (WHERE a.pct >= 100),
        'em_dia',     COUNT(*) FILTER (WHERE a.pct < 100 AND a.status = 'Em dia'),
        'em_atraso',  COUNT(*) FILTER (WHERE a.pct < 100 AND a.status IN ('Em atraso', 'atrasada')),
        'exec_media', COALESCE(AVG(a.pct), 0)
      ) AS kpi
    FROM public.activities a
    JOIN public.eixos e
      ON  e.name       = a.n1
      AND e.program_id = a.program_id
    WHERE a.program_id IS NOT NULL
      AND a.n1 <> ''
    GROUP BY e.id
  ) sub;

  -- ── Insert snapshot row ───────────────────────────────────────
  INSERT INTO public.snapshots (label, snap_date, kpi, by_n0, by_n1, created_by)
  VALUES (
    to_char(current_date, 'YYYY-MM-DD'),
    now(),
    v_kpi,
    v_by_n0,
    v_by_n1,
    auth.uid()
  );

END;
$$;

-- Allow authenticated users to call this function (Admin page triggers it)
GRANT EXECUTE ON FUNCTION public.daily_snapshot() TO authenticated;
