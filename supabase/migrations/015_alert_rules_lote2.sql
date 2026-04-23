-- Migration 015: Seed 5 additional alert rules (Lote 2)

INSERT INTO public.alert_rules (rule_key, enabled, threshold, severity, label, description)
VALUES
  ('risks_many_in_plan',     true, 5,  'medium',   'Muitos riscos abertos',
   'Plano com mais de threshold riscos em Aberto ou Em mitigação'),
  ('risk_new_critical',      true, 7,  'critical', 'Novo risco crítico',
   'Risco criado há threshold dias com grade crítico (definido em Admin → Riscos)'),
  ('plan_declining',         true, 5,  'high',     'Plano em declínio',
   'Concretização caiu >= threshold pp nos últimos 14 dias'),
  ('plan_pds_stale',         true, 30, 'medium',   'PDS desactualizado',
   'Último PDS criado há mais de threshold dias'),
  ('plan_activities_stale',  true, 30, 'medium',   'Actividades sem progresso',
   'Actividades do plano sem actualização há mais de threshold dias')
ON CONFLICT (rule_key) DO NOTHING;
