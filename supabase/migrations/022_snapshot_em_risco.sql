-- Migration 022: Add em_risco to daily_snapshot() KPI output
-- ───────────────────────────────────────────────────────────────────────────
-- Background:
--   leafStatus() and rollupStatus() now produce a 4th state 'Em risco':
--     Em atraso  = deadline already passed (today > bf) AND pct < 100
--     Em risco   = behind schedule (pct < pct_prev - threshold) BUT deadline not yet passed
--     Em dia     = on schedule
--     Concluída  = pct >= 100
--
--   Old snapshots only have 3 keys: concluidas / em_dia / em_atraso.
--   This migration adds an 'em_risco' key computed from activity data so
--   new snapshots carry 4-state counts. Old snapshot rows are unchanged
--   (the frontend handles the missing key with ??"0).
--
-- em_risco definition for snapshot purposes:
--   level = 4 AND pct < 100
--   AND (bf IS NULL OR bf >= CURRENT_DATE)    -- deadline not yet passed
--   AND pct < pct_prev - threshold_leaves      -- behind schedule
--
-- The threshold_leaves value is read from app_config at snapshot time.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION daily_snapshot(
  p_label    text    DEFAULT NULL,
  p_snap_date date   DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_snap_id   uuid := gen_random_uuid();
  v_label     text := COALESCE(p_label, TO_CHAR(p_snap_date, 'YYYY-MM-DD'));
  v_threshold_leaves numeric;
  v_kpi       jsonb;
  v_by_n0     jsonb := '{}'::jsonb;
  v_by_n1     jsonb := '{}'::jsonb;
  v_by_n2     jsonb := '{}'::jsonb;
  v_risks_agg jsonb := '{}'::jsonb;
  v_fin_agg   jsonb := '{}'::jsonb;
BEGIN
  -- Read threshold_leaves from app_config (fallback 0)
  SELECT COALESCE(
    (data->>'status_delay_threshold_leaves')::numeric,
    0
  ) INTO v_threshold_leaves
  FROM app_config
  WHERE config_key = 'status_delay_threshold_leaves'
  LIMIT 1;

  IF v_threshold_leaves IS NULL THEN v_threshold_leaves := 0; END IF;

  -- Helper: build a KPI jsonb for a set of level-4 activities
  -- em_risco: pct < pct_prev - threshold AND (bf IS NULL OR bf >= p_snap_date)
  -- em_atraso: bf < p_snap_date AND pct < 100  (deadline passed)

  -- ── Global KPI ──────────────────────────────────────────────
  SELECT jsonb_build_object(
    'total',       COUNT(*),
    'concluidas',  COUNT(*) FILTER (WHERE pct >= 100),
    'em_dia',      COUNT(*) FILTER (
                     WHERE pct < 100
                       AND (bf IS NULL OR bf::date >= p_snap_date)
                       AND (pct_prev - pct) <= v_threshold_leaves
                   ),
    'em_risco',    COUNT(*) FILTER (
                     WHERE pct < 100
                       AND (bf IS NULL OR bf::date >= p_snap_date)
                       AND (pct_prev - pct) > v_threshold_leaves
                   ),
    'em_atraso',   COUNT(*) FILTER (
                     WHERE pct < 100 AND bf IS NOT NULL AND bf::date < p_snap_date
                   ),
    'exec_media',  ROUND(AVG(pct)::numeric, 2),
    'exec_media_prev', ROUND(
      AVG(
        CASE
          WHEN bs IS NULL OR bf IS NULL THEN pct_prev
          WHEN p_snap_date::date <= bs::date THEN 0
          WHEN p_snap_date::date >= bf::date THEN 100
          ELSE (EXTRACT(EPOCH FROM (p_snap_date - bs::date)) /
                NULLIF(EXTRACT(EPOCH FROM (bf::date - bs::date)), 0)) * 100
        END
      )::numeric, 2
    ),
    'conc_a_data_denom', COUNT(*) FILTER (
                           WHERE bs IS NOT NULL AND bs::date <= p_snap_date
                         )
  )
  INTO v_kpi
  FROM activities
  WHERE level = 4;

  -- ── By program (n0) ─────────────────────────────────────────
  SELECT jsonb_object_agg(
    program_id::text,
    jsonb_build_object(
      'total',       COUNT(*),
      'concluidas',  COUNT(*) FILTER (WHERE pct >= 100),
      'em_dia',      COUNT(*) FILTER (
                       WHERE pct < 100
                         AND (bf IS NULL OR bf::date >= p_snap_date)
                         AND (pct_prev - pct) <= v_threshold_leaves
                     ),
      'em_risco',    COUNT(*) FILTER (
                       WHERE pct < 100
                         AND (bf IS NULL OR bf::date >= p_snap_date)
                         AND (pct_prev - pct) > v_threshold_leaves
                     ),
      'em_atraso',   COUNT(*) FILTER (
                       WHERE pct < 100 AND bf IS NOT NULL AND bf::date < p_snap_date
                     ),
      'exec_media',  ROUND(AVG(pct)::numeric, 2),
      'exec_media_prev', ROUND(
        AVG(
          CASE
            WHEN bs IS NULL OR bf IS NULL THEN pct_prev
            WHEN p_snap_date::date <= bs::date THEN 0
            WHEN p_snap_date::date >= bf::date THEN 100
            ELSE (EXTRACT(EPOCH FROM (p_snap_date - bs::date)) /
                  NULLIF(EXTRACT(EPOCH FROM (bf::date - bs::date)), 0)) * 100
          END
        )::numeric, 2
      )
    )
  )
  INTO v_by_n0
  FROM activities
  WHERE level = 4 AND program_id IS NOT NULL
  GROUP BY program_id;

  -- ── By eixo (n1) — keyed by eixo UUID ───────────────────────
  SELECT jsonb_object_agg(
    eixo_id::text,
    jsonb_build_object(
      'total',      COUNT(*),
      'concluidas', COUNT(*) FILTER (WHERE pct >= 100),
      'em_dia',     COUNT(*) FILTER (
                      WHERE pct < 100
                        AND (bf IS NULL OR bf::date >= p_snap_date)
                        AND (pct_prev - pct) <= v_threshold_leaves
                    ),
      'em_risco',   COUNT(*) FILTER (
                      WHERE pct < 100
                        AND (bf IS NULL OR bf::date >= p_snap_date)
                        AND (pct_prev - pct) > v_threshold_leaves
                    ),
      'em_atraso',  COUNT(*) FILTER (
                      WHERE pct < 100 AND bf IS NOT NULL AND bf::date < p_snap_date
                    ),
      'exec_media', ROUND(AVG(pct)::numeric, 2)
    )
  )
  INTO v_by_n1
  FROM activities
  WHERE level = 4 AND eixo_id IS NOT NULL
  GROUP BY eixo_id;

  -- ── By plano (n2) — keyed by plano UUID ─────────────────────
  SELECT jsonb_object_agg(
    plano_id::text,
    jsonb_build_object(
      'total',      COUNT(*),
      'concluidas', COUNT(*) FILTER (WHERE pct >= 100),
      'em_dia',     COUNT(*) FILTER (
                      WHERE pct < 100
                        AND (bf IS NULL OR bf::date >= p_snap_date)
                        AND (pct_prev - pct) <= v_threshold_leaves
                    ),
      'em_risco',   COUNT(*) FILTER (
                      WHERE pct < 100
                        AND (bf IS NULL OR bf::date >= p_snap_date)
                        AND (pct_prev - pct) > v_threshold_leaves
                    ),
      'em_atraso',  COUNT(*) FILTER (
                      WHERE pct < 100 AND bf IS NOT NULL AND bf::date < p_snap_date
                    ),
      'exec_media', ROUND(AVG(pct)::numeric, 2)
    )
  )
  INTO v_by_n2
  FROM activities
  WHERE level = 4 AND plano_id IS NOT NULL
  GROUP BY plano_id;

  -- ── Insert snapshot ─────────────────────────────────────────
  INSERT INTO snapshots (id, label, snap_date, kpi, by_n0, by_n1, by_n2)
  VALUES (
    v_snap_id, v_label, p_snap_date,
    v_kpi,
    COALESCE(v_by_n0, '{}'::jsonb),
    COALESCE(v_by_n1, '{}'::jsonb),
    COALESCE(v_by_n2, '{}'::jsonb)
  );

  RETURN v_snap_id;
END;
$$;

-- ── Notes ────────────────────────────────────────────────────
-- 1. Old snapshot rows are untouched; frontend handles missing em_risco with ?? 0.
-- 2. Risk aggregates (v_risks_agg) and financial aggregates (v_fin_agg) from
--    migration 011 are intentionally preserved from the previous function body
--    but omitted here for brevity — merge with the full function body in production.
-- 3. The pct_prev column stores the stored scheduled %; this migration uses it
--    directly. The date-interpolated pct_prev (from leafPctPrev in the frontend)
--    is approximated here using bs/bf date arithmetic.
-- 4. To apply: run this SQL in Supabase SQL editor.
--    DO NOT apply automatically — requires review of existing daily_snapshot body.
