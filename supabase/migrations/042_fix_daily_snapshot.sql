-- Migration 042: fix daily_snapshot() — band thresholds from app_config
--
-- Context: applied MANUALLY via the Supabase Dashboard on 2026-06-24 and validated (PE total
-- 755, 6 eixos; parity with Dashboard cards). The cron job 'daily-snapshot' (59 23 * * *)
-- resumed successfully the same night. This file versions that change.
--
-- The previous function crashed nightly since ~2026-05-24 with
--   ERROR 42703: column p.threshold_leaves does not exist
-- after the schema moved to the two-ended band model. This version reads
-- status_delay_threshold_leaves_low/high from app_config (defaults 5/10), classifies leaves
-- per rollup.ts (planned_pct interpolated bs..COALESCE(bf,finish), pct_prev fallback;
-- precedence Concluida -> Em atraso by date -> band), and preserves risks/financials.
--
-- Safe to re-run (CREATE OR REPLACE FUNCTION). Re-running only redefines the function.

CREATE OR REPLACE FUNCTION public.daily_snapshot()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_low         numeric;
  v_high        numeric;
  v_kpi         jsonb;
  v_by_n0       jsonb;
  v_by_n1       jsonb;
  v_by_n2       jsonb;
  v_risk_totals jsonb;
  v_risk_plano  jsonb;
  v_risk_top    jsonb;
  v_fin_totals  jsonb;
  v_fin_program jsonb;
BEGIN

  -- Thresholds de folha do app_config (data e' texto/jsonb -> extrai numero)
  SELECT COALESCE(NULLIF(regexp_replace(data::text, '[^0-9.-]', '', 'g'), '')::numeric, 5)
    INTO v_low
  FROM public.app_config WHERE config_key = 'status_delay_threshold_leaves_low';

  SELECT COALESCE(NULLIF(regexp_replace(data::text, '[^0-9.-]', '', 'g'), '')::numeric, 10)
    INTO v_high
  FROM public.app_config WHERE config_key = 'status_delay_threshold_leaves_high';

  v_low  := COALESCE(v_low, 5);
  v_high := COALESCE(v_high, 10);

  -- Estado por folha, calculado UMA vez (espelha rollup.ts)
  DROP TABLE IF EXISTS _leaf_state;
  CREATE TEMP TABLE _leaf_state AS
  WITH leaf AS (
    SELECT
      a.id, a.program_id, a.plano_id, a.n1, a.pct, a.pct_prev,
      COALESCE(a.bf, a.finish) AS deadline,
      CASE
        WHEN a.bs IS NULL OR COALESCE(a.bf, a.finish) IS NULL THEN a.pct_prev
        WHEN CURRENT_DATE <= a.bs                              THEN 0
        WHEN CURRENT_DATE >= COALESCE(a.bf, a.finish)          THEN 100
        WHEN COALESCE(a.bf, a.finish) <= a.bs                  THEN 100
        ELSE (CURRENT_DATE - a.bs)::numeric
             / (COALESCE(a.bf, a.finish) - a.bs)::numeric * 100
      END AS planned_pct
    FROM public.activities a
    WHERE a.level = 4
  )
  SELECT
    l.id, l.program_id, l.plano_id, l.n1, l.pct, l.pct_prev,
    CASE
      WHEN l.pct >= 100                                         THEN 'concluida'
      WHEN l.deadline IS NOT NULL AND CURRENT_DATE > l.deadline THEN 'em_atraso'
      WHEN (l.planned_pct - l.pct) <= v_low                    THEN 'em_dia'
      WHEN (l.planned_pct - l.pct) <= v_high                   THEN 'em_risco'
      ELSE 'em_atraso'
    END AS state
  FROM leaf l;

  -- Overall KPI
  SELECT jsonb_build_object(
    'total',      COUNT(*),
    'concluidas', COUNT(*) FILTER (WHERE state = 'concluida'),
    'em_dia',     COUNT(*) FILTER (WHERE state = 'em_dia'),
    'em_risco',   COUNT(*) FILTER (WHERE state = 'em_risco'),
    'em_atraso',  COUNT(*) FILTER (WHERE state = 'em_atraso'),
    'exec_media', COALESCE(AVG(pct), 0)
  ) INTO v_kpi
  FROM _leaf_state;

  -- by_n0: program
  SELECT COALESCE(jsonb_object_agg(t.program_id::text, t.kpi), '{}'::jsonb)
  INTO v_by_n0
  FROM (
    SELECT program_id, jsonb_build_object(
      'total',      COUNT(*),
      'concluidas', COUNT(*) FILTER (WHERE state = 'concluida'),
      'em_dia',     COUNT(*) FILTER (WHERE state = 'em_dia'),
      'em_risco',   COUNT(*) FILTER (WHERE state = 'em_risco'),
      'em_atraso',  COUNT(*) FILTER (WHERE state = 'em_atraso'),
      'exec_media', COALESCE(AVG(pct), 0)
    ) AS kpi
    FROM _leaf_state
    WHERE program_id IS NOT NULL
    GROUP BY program_id
  ) t;

  -- by_n1: eixo (junta por nome n1 <-> eixos.name no mesmo programa)
  SELECT COALESCE(jsonb_object_agg(t.eixo_id::text, t.kpi), '{}'::jsonb)
  INTO v_by_n1
  FROM (
    SELECT e.id AS eixo_id, jsonb_build_object(
      'total',      COUNT(*),
      'concluidas', COUNT(*) FILTER (WHERE ls.state = 'concluida'),
      'em_dia',     COUNT(*) FILTER (WHERE ls.state = 'em_dia'),
      'em_risco',   COUNT(*) FILTER (WHERE ls.state = 'em_risco'),
      'em_atraso',  COUNT(*) FILTER (WHERE ls.state = 'em_atraso'),
      'exec_media', COALESCE(AVG(ls.pct), 0)
    ) AS kpi
    FROM _leaf_state ls
    JOIN public.eixos e ON e.name = ls.n1 AND e.program_id = ls.program_id
    WHERE ls.program_id IS NOT NULL AND ls.n1 <> ''
    GROUP BY e.id
  ) t;

  -- by_n2: plano (parte de planos para que planos sem folhas aparecam a 0)
  SELECT COALESCE(jsonb_object_agg(t.plano_id::text, t.kpi), '{}'::jsonb)
  INTO v_by_n2
  FROM (
    SELECT pl.id AS plano_id, jsonb_build_object(
      'total',           COUNT(ls.id),
      'concluidas',      COUNT(ls.id) FILTER (WHERE ls.state = 'concluida'),
      'em_dia',          COUNT(ls.id) FILTER (WHERE ls.state = 'em_dia'),
      'em_risco',        COUNT(ls.id) FILTER (WHERE ls.state = 'em_risco'),
      'em_atraso',       COUNT(ls.id) FILTER (WHERE ls.state = 'em_atraso'),
      'exec_media',      COALESCE(AVG(ls.pct),      0),
      'exec_media_prev', COALESCE(AVG(ls.pct_prev), 0)
    ) AS kpi
    FROM public.planos pl
    LEFT JOIN _leaf_state ls ON ls.plano_id = pl.id
    GROUP BY pl.id
  ) t;

  -- risks.totals (preservada)
  SELECT jsonb_build_object(
    'total',       COUNT(*),
    'abertos',     COUNT(*) FILTER (WHERE r.status IN ('Aberto', 'Open', 'Em mitigação')),
    'mitigados',   COUNT(*) FILTER (WHERE r.status IN ('Mitigado', 'Closed')),
    'criticos',    COUNT(*) FILTER (WHERE (r.probability * r.impact) >= 15),
    'altos',       COUNT(*) FILTER (WHERE (r.probability * r.impact) >= 10 AND (r.probability * r.impact) < 15),
    'medios',      COUNT(*) FILTER (WHERE (r.probability * r.impact) >=  5 AND (r.probability * r.impact) < 10),
    'baixos',      COUNT(*) FILTER (WHERE (r.probability * r.impact) <  5),
    'grade_medio', ROUND(COALESCE(AVG(r.probability::numeric * r.impact), 0), 2)
  )
  INTO v_risk_totals
  FROM public.risks r;

  -- risks.by_plano (preservada)
  SELECT COALESCE(jsonb_object_agg(sub.plano_id::text, sub.plano_risks), '{}'::jsonb)
  INTO v_risk_plano
  FROM (
    SELECT
      r.plano_id,
      jsonb_build_object(
        'total',       COUNT(*),
        'abertos',     COUNT(*) FILTER (WHERE r.status IN ('Aberto', 'Open', 'Em mitigação')),
        'mitigados',   COUNT(*) FILTER (WHERE r.status IN ('Mitigado', 'Closed')),
        'criticos',    COUNT(*) FILTER (WHERE (r.probability * r.impact) >= 15),
        'grade_medio', ROUND(COALESCE(AVG(r.probability::numeric * r.impact), 0), 2)
      ) AS plano_risks
    FROM public.risks r
    WHERE r.plano_id IS NOT NULL
    GROUP BY r.plano_id
  ) sub;

  -- risks.top_criticos (preservada)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',          t.id::text,
        'planoId',     t.plano_id::text,
        'description', t.description,
        'grade',       t.grade,
        'status',      t.status
      ) ORDER BY t.grade DESC
    ),
    '[]'::jsonb
  )
  INTO v_risk_top
  FROM (
    SELECT r.id, r.plano_id, r.description, (r.probability * r.impact) AS grade, r.status
    FROM public.risks r
    WHERE r.status NOT IN ('Mitigado', 'Closed')
    ORDER BY (r.probability * r.impact) DESC
    LIMIT 5
  ) t;

  -- financials.totals (preservada)
  WITH
  budget AS (
    SELECT
      COALESCE(SUM(jv.val::numeric),                                  0) AS total_budget,
      COALESCE(SUM(jv.val::numeric) FILTER (WHERE fbl.capex = true),  0) AS capex_budget,
      COALESCE(SUM(jv.val::numeric) FILTER (WHERE fbl.capex = false), 0) AS opex_budget
    FROM public.fin_budget_lines fbl
    CROSS JOIN LATERAL jsonb_each_text(fbl.values) AS jv(period, val)
  ),
  executed AS (
    SELECT COALESCE(SUM(amount), 0) AS total_executed
    FROM public.fin_invoices
    WHERE status = 'Paga'
  ),
  overdue AS (
    SELECT
      COUNT(*)                 AS cnt,
      COALESCE(SUM(amount), 0) AS val
    FROM public.fin_invoices
    WHERE status IN ('Recebida', 'Aprovada')
      AND due_date < CURRENT_DATE
  )
  SELECT jsonb_build_object(
    'total_budget',            b.total_budget,
    'capex_budget',            b.capex_budget,
    'opex_budget',             b.opex_budget,
    'total_executed',          e.total_executed,
    'total_pct',               CASE WHEN b.total_budget > 0
                                    THEN ROUND(100.0 * e.total_executed / b.total_budget, 1)
                                    ELSE 0 END,
    'facturas_overdue_count',  o.cnt,
    'facturas_overdue_value',  o.val
  )
  INTO v_fin_totals
  FROM budget b, executed e, overdue o;

  -- financials.by_program (preservada)
  WITH
  budget_by_prog AS (
    SELECT
      fbl.program_id,
      COALESCE(SUM(jv.val::numeric),                                  0) AS total_budget,
      COALESCE(SUM(jv.val::numeric) FILTER (WHERE fbl.capex = true),  0) AS capex_budget,
      COALESCE(SUM(jv.val::numeric) FILTER (WHERE fbl.capex = false), 0) AS opex_budget
    FROM public.fin_budget_lines fbl
    CROSS JOIN LATERAL jsonb_each_text(fbl.values) AS jv(period, val)
    WHERE fbl.program_id IS NOT NULL
    GROUP BY fbl.program_id
  ),
  exec_by_prog AS (
    SELECT
      i.program_id,
      COALESCE(SUM(i.amount), 0) AS total_executed
    FROM public.fin_invoices i
    WHERE i.status = 'Paga'
      AND i.program_id IS NOT NULL
    GROUP BY i.program_id
  )
  SELECT COALESCE(jsonb_object_agg(
    b.program_id::text,
    jsonb_build_object(
      'total_budget',   b.total_budget,
      'capex_budget',   b.capex_budget,
      'opex_budget',    b.opex_budget,
      'total_executed', COALESCE(e.total_executed, 0),
      'total_pct',      CASE WHEN b.total_budget > 0
                              THEN ROUND(100.0 * COALESCE(e.total_executed, 0) / b.total_budget, 1)
                              ELSE 0 END
    )
  ), '{}'::jsonb)
  INTO v_fin_program
  FROM budget_by_prog b
  LEFT JOIN exec_by_prog e ON e.program_id = b.program_id;

  -- Insert snapshot row
  INSERT INTO public.snapshots
    (label, snap_date, kpi, by_n0, by_n1, by_n2, risks, financials, created_by)
  VALUES (
    to_char(current_date, 'YYYY-MM-DD'),
    now(),
    v_kpi,
    v_by_n0,
    v_by_n1,
    v_by_n2,
    jsonb_build_object(
      'totals',       v_risk_totals,
      'by_plano',     v_risk_plano,
      'top_criticos', v_risk_top
    ),
    jsonb_build_object(
      'totals',     v_fin_totals,
      'by_program', v_fin_program
    ),
    auth.uid()
  );

  DROP TABLE IF EXISTS _leaf_state;

END;
$function$;
