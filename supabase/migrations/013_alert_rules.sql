-- Migration 013: alert_rules table
-- Configurable alert rules shown on the Dashboard executive brief.
-- Safe to run multiple times — uses IF NOT EXISTS and DO $$ guards.

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key    TEXT    NOT NULL UNIQUE,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  threshold   NUMERIC,
  severity    TEXT    NOT NULL DEFAULT 'medium'
              CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  label       TEXT    NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Auto updated_at trigger (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_alert_rules_updated_at'
  ) THEN
    CREATE TRIGGER trg_alert_rules_updated_at
      BEFORE UPDATE ON public.alert_rules
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='alert_rules_select') THEN
    CREATE POLICY "alert_rules_select" ON public.alert_rules
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='alert_rules_update') THEN
    CREATE POLICY "alert_rules_update" ON public.alert_rules
      FOR UPDATE TO authenticated
      USING (public.current_user_role() = 'admin')
      WITH CHECK (public.current_user_role() = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='alert_rules_insert') THEN
    CREATE POLICY "alert_rules_insert" ON public.alert_rules
      FOR INSERT TO authenticated
      WITH CHECK (public.current_user_role() = 'admin');
  END IF;
END $$;

-- Seed initial rules (idempotent)
INSERT INTO public.alert_rules (rule_key, enabled, threshold, severity, label, description)
VALUES
  ('risk_critical',   true, 15, 'critical', 'Risco crítico',
   'Riscos com grade >= threshold (prob × impacto)'),
  ('invoice_overdue', true,  0, 'high',     'Factura em atraso',
   'Facturas com due_date passada e estado Recebida/Aprovada'),
  ('plan_stagnated',  true, 14, 'medium',   'Plano sem progresso',
   'Planos sem alteração de concretização há X dias')
ON CONFLICT (rule_key) DO NOTHING;
