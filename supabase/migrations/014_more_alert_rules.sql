-- Migration 014: Seed 3 additional alert rules (Lote 1)

INSERT INTO public.alert_rules (rule_key, enabled, threshold, severity, label, description)
VALUES
  ('activity_late_chronic', true, 30,  'high',     'Actividade crónica em atraso',
   'Actividade em atraso há mais de threshold dias'),
  ('budget_exceeded',       true, 100, 'critical', 'Orçamento ultrapassado',
   'Execução do orçamento excede threshold% do total'),
  ('invoice_overdue_long',  true, 30,  'critical', 'Factura em atraso há muito tempo',
   'Factura com due_date passada há mais de threshold dias')
ON CONFLICT (rule_key) DO NOTHING;
