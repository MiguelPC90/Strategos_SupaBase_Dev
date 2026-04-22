-- Migration 011: Enrich daily_snapshot() with by_n2, risks, financials
--
-- Adds 3 new columns to snapshots and replaces daily_snapshot() to populate them.
-- Safe to run multiple times — uses IF NOT EXISTS and CREATE OR REPLACE.
--
-- New columns:
--   by_n2       — plano-level KPI aggregates (mirrors by_n1 structure + exec_media_prev)
--   risks       — { totals, by_plano, top_criticos }
--   financials  — { totals, by_program }
--
-- Grade thresholds (probability * impact, range 1–25):
--   baixo < 5 | medio 5–9 | alto 10–14 | critico >= 15
--
-- Budget = SUM of fin_budget_lines.values JSONB (period→amount map).
-- Executed = SUM of fin_invoices.amount WHERE status = 'Paga'.
-- Overdue   = fin_invoices WHERE status IN ('Recebida','Aprovada') AND due_date < CURRENT_DATE.

-- ── 1. Add new columns ────────────────────────────────────────────────────────
ALTER TABLE public.snapshots
  ADD COLUMN IF NOT EXISTS by_n2      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risks      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS financials JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 2. Replace daily_snapshot() ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.daily_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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

  -- ── Overall KPI (all activities) ──────────────────────────────────────────────
  SELECT jsonb_build_object(
    'total',      COUNT(*),
    'concluidas', COUNT(*) FILTER (WHERE pct >= 100),
    'em_dia',     COUNT(*) FILTER (WHERE pct < 100 AND status = 'Em dia'),
    'em_atraso',  COUNT(*) FILTER (WHERE pct < 100 AND status IN ('Em atraso', 'atrasada')),
    'exec_media', COALESCE(AVG(pct), 0)
  )
  INTO v_kpi
  FROM public.activities;

  -- ── by_n0: KPIs keyed by program UUID ────────────────────────────────────────
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

  -- ── by_n1: KPIs keyed by eixo UUID ───────────────────────────────────────────
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

  -- ── by_n2: KPIs keyed by plano UUID (ALL planos, including empty ones) ────────
  -- LEFT JOIN ensures planos with zero activities still appear with zero counts.
  SELECT COALESCE(jsonb_object_agg(pl.id::text, kpi), '{}'::jsonb)
  INTO v_by_n2
  FROM (
    SELECT
      pl.id,
      jsonb_build_object(
        'total',           COUNT(a.id),
        'concluidas',      COUNT(a.id) FILTER (WHERE a.pct >= 100),
        'em_dia',          COUNT(a.id) FILTER (WHERE a.pct < 100 AND a.status = 'Em dia'),
        'em_atraso',       COUNT(a.id) FILTER (WHERE a.pct < 100 AND a.status IN ('Em atraso', 'atrasada')),
        'exec_media',      COALESCE(AVG(a.pct),      0),
        'exec_media_prev', COALESCE(AVG(a.pct_prev), 0)
      ) AS kpi
    FROM public.planos pl
    LEFT JOIN public.activities a ON a.plano_id = pl.id
    GROUP BY pl.id
  ) sub;

  -- ── risks.totals ──────────────────────────────────────────────────────────────
  -- Accepts both Portuguese ('Aberto','Em mitigação','Mitigado') and English
  -- ('Open','Closed') status values for forward/backward compatibility.
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

  -- ── risks.by_plano ────────────────────────────────────────────────────────────
  -- Groups by pds_entries.plano_id; excludes risks on pds_entries with no plano.
  SELECT COALESCE(jsonb_object_agg(pe.plano_id::text, plano_risks), '{}'::jsonb)
  INTO v_risk_plano
  FROM (
    SELECT
      pe.plano_id,
      jsonb_build_object(
        'total',       COUNT(*),
        'abertos',     COUNT(*) FILTER (WHERE r.status IN ('Aberto', 'Open', 'Em mitigação')),
        'mitigados',   COUNT(*) FILTER (WHERE r.status IN ('Mitigado', 'Closed')),
        'criticos',    COUNT(*) FILTER (WHERE (r.probability * r.impact) >= 15),
        'grade_medio', ROUND(COALESCE(AVG(r.probability::numeric * r.impact), 0), 2)
      ) AS plano_risks
    FROM public.risks r
    JOIN public.pds_entries pe ON pe.id = r.pds_id
    WHERE pe.plano_id IS NOT NULL
    GROUP BY pe.plano_id
  ) sub;

  -- ── risks.top_criticos — top 5 open risks by grade ────────────────────────────
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
    SELECT r.id, pe.plano_id, r.description, (r.probability * r.impact) AS grade, r.status
    FROM public.risks r
    JOIN public.pds_entries pe ON pe.id = r.pds_id
    WHERE r.status NOT IN ('Mitigado', 'Closed')
    ORDER BY (r.probability * r.impact) DESC
    LIMIT 5
  ) t;

  -- ── financials.totals ─────────────────────────────────────────────────────────
  -- Budget = SUM of all period amounts across all budget lines.
  -- Executed = SUM of paid invoice amounts.
  -- Overdue  = invoices past due_date that are still Recebida/Aprovada.
  WITH
  budget AS (
    SELECT
      COALESCE(SUM(jv.val::numeric),                                         0) AS total_budget,
      COALESCE(SUM(jv.val::numeric) FILTER (WHERE fbl.capex = true),         0) AS capex_budget,
      COALESCE(SUM(jv.val::numeric) FILTER (WHERE fbl.capex = false),        0) AS opex_budget
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
      COUNT(*)             AS cnt,
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

  -- ── financials.by_program ─────────────────────────────────────────────────────
  -- Budget and executed are resolved to program_id via pds_entries.
  WITH
  budget_by_prog AS (
    SELECT
      pe.program_id,
      COALESCE(SUM(jv.val::numeric),                                        0) AS total_budget,
      COALESCE(SUM(jv.val::numeric) FILTER (WHERE fbl.capex = true),        0) AS capex_budget,
      COALESCE(SUM(jv.val::numeric) FILTER (WHERE fbl.capex = false),       0) AS opex_budget
    FROM public.fin_budget_lines fbl
    JOIN public.pds_entries pe ON pe.id = fbl.pds_id
    CROSS JOIN LATERAL jsonb_each_text(fbl.values) AS jv(period, val)
    WHERE pe.program_id IS NOT NULL
    GROUP BY pe.program_id
  ),
  exec_by_prog AS (
    SELECT
      pe.program_id,
      COALESCE(SUM(i.amount), 0) AS total_executed
    FROM public.fin_invoices i
    JOIN public.pds_entries pe ON pe.id = i.pds_id
    WHERE i.status = 'Paga'
      AND pe.program_id IS NOT NULL
    GROUP BY pe.program_id
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

  -- ── Insert snapshot row ───────────────────────────────────────────────────────
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

END;
$$;

-- Allow authenticated users to call this function (Admin page triggers it)
GRANT EXECUTE ON FUNCTION public.daily_snapshot() TO authenticated;
