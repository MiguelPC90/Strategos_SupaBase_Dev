-- Migration 005: Rename Portuguese identifiers to English
-- Run this ONLY if you already applied schema.sql or earlier migrations
-- with Portuguese names. Safe to run multiple times (uses IF EXISTS).
-- For a fresh install, just run the updated schema.sql + migrations 003/004.

-- ── Rename tables ─────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS fin_rubricas  RENAME TO fin_budget_lines;
ALTER TABLE IF EXISTS fin_contratos RENAME TO fin_contracts;
ALTER TABLE IF EXISTS fin_facturas  RENAME TO fin_invoices;
ALTER TABLE IF EXISTS fte_recursos  RENAME TO fte_resources;
ALTER TABLE IF EXISTS pessoas       RENAME TO people;

-- ── activities ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='nivel') THEN
    ALTER TABLE activities RENAME COLUMN nivel TO level;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='nome') THEN
    ALTER TABLE activities RENAME COLUMN nome TO name;
  END IF;
END $$;

-- ── pds_entries ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pds_entries' AND column_name='plano') THEN
    ALTER TABLE pds_entries RENAME COLUMN plano TO plan_name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pds_entries' AND column_name='compromissos') THEN
    ALTER TABLE pds_entries RENAME COLUMN compromissos TO commitments;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pds_entries' AND column_name='compromissos_items') THEN
    ALTER TABLE pds_entries RENAME COLUMN compromissos_items TO commitments_items;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pds_entries' AND column_name='avancos') THEN
    ALTER TABLE pds_entries RENAME COLUMN avancos TO progress;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pds_entries' AND column_name='avancos_items') THEN
    ALTER TABLE pds_entries RENAME COLUMN avancos_items TO progress_items;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pds_entries' AND column_name='proximos') THEN
    ALTER TABLE pds_entries RENAME COLUMN proximos TO next_steps;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pds_entries' AND column_name='proximos_items') THEN
    ALTER TABLE pds_entries RENAME COLUMN proximos_items TO next_steps_items;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pds_entries' AND column_name='atencao') THEN
    ALTER TABLE pds_entries RENAME COLUMN atencao TO attention;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pds_entries' AND column_name='atencao_items') THEN
    ALTER TABLE pds_entries RENAME COLUMN atencao_items TO attention_items;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pds_entries' AND column_name='fte_dias_uteis') THEN
    ALTER TABLE pds_entries RENAME COLUMN fte_dias_uteis TO fte_working_days;
  END IF;
END $$;

-- ── risks ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='risks' AND column_name='prob') THEN
    ALTER TABLE risks RENAME COLUMN prob TO probability;
  END IF;
END $$;

-- ── fin_budget_lines (was fin_rubricas) ──────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_budget_lines' AND column_name='categoria') THEN
    ALTER TABLE fin_budget_lines RENAME COLUMN categoria TO category;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_budget_lines' AND column_name='moeda') THEN
    ALTER TABLE fin_budget_lines RENAME COLUMN moeda TO currency;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_budget_lines' AND column_name='valores') THEN
    ALTER TABLE fin_budget_lines RENAME COLUMN valores TO values;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_budget_lines' AND column_name='nota') THEN
    ALTER TABLE fin_budget_lines RENAME COLUMN nota TO note;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_budget_lines' AND column_name='fonte') THEN
    ALTER TABLE fin_budget_lines RENAME COLUMN fonte TO source_ref;
  END IF;
END $$;

-- ── fin_contracts (was fin_contratos) ────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_contracts' AND column_name='fornecedor') THEN
    ALTER TABLE fin_contracts RENAME COLUMN fornecedor TO supplier;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_contracts' AND column_name='categoria') THEN
    ALTER TABLE fin_contracts RENAME COLUMN categoria TO category;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_contracts' AND column_name='moeda') THEN
    ALTER TABLE fin_contracts RENAME COLUMN moeda TO currency;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_contracts' AND column_name='cambio_ref') THEN
    ALTER TABLE fin_contracts RENAME COLUMN cambio_ref TO exchange_rate_ref;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_contracts' AND column_name='valor_total') THEN
    ALTER TABLE fin_contracts RENAME COLUMN valor_total TO total_amount;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_contracts' AND column_name='data_adj') THEN
    ALTER TABLE fin_contracts RENAME COLUMN data_adj TO award_date;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_contracts' AND column_name='descricao') THEN
    ALTER TABLE fin_contracts RENAME COLUMN descricao TO description;
  END IF;
END $$;

-- ── fin_invoices (was fin_facturas) ──────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='contrato_id') THEN
    ALTER TABLE fin_invoices RENAME COLUMN contrato_id TO contract_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='fornecedor') THEN
    ALTER TABLE fin_invoices RENAME COLUMN fornecedor TO supplier;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='doc_tipo') THEN
    ALTER TABLE fin_invoices RENAME COLUMN doc_tipo TO doc_type;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='descricao') THEN
    ALTER TABLE fin_invoices RENAME COLUMN descricao TO description;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='valor') THEN
    ALTER TABLE fin_invoices RENAME COLUMN valor TO amount;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='moeda') THEN
    ALTER TABLE fin_invoices RENAME COLUMN moeda TO currency;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='cambio') THEN
    ALTER TABLE fin_invoices RENAME COLUMN cambio TO exchange_rate;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='data_emissao') THEN
    ALTER TABLE fin_invoices RENAME COLUMN data_emissao TO issue_date;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='data_vencimento') THEN
    ALTER TABLE fin_invoices RENAME COLUMN data_vencimento TO due_date;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='data_pagamento') THEN
    ALTER TABLE fin_invoices RENAME COLUMN data_pagamento TO payment_date;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='estado') THEN
    ALTER TABLE fin_invoices RENAME COLUMN estado TO status;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='memorando') THEN
    ALTER TABLE fin_invoices RENAME COLUMN memorando TO memo;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fin_invoices' AND column_name='app_contrato_id') THEN
    ALTER TABLE fin_invoices RENAME COLUMN app_contrato_id TO app_contract_id;
  END IF;
END $$;

-- ── fte_resources (was fte_recursos) ─────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fte_resources' AND column_name='nome') THEN
    ALTER TABLE fte_resources RENAME COLUMN nome TO name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fte_resources' AND column_name='unidade') THEN
    ALTER TABLE fte_resources RENAME COLUMN unidade TO org_unit;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fte_resources' AND column_name='perfil') THEN
    ALTER TABLE fte_resources RENAME COLUMN perfil TO role;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fte_resources' AND column_name='tipo') THEN
    ALTER TABLE fte_resources RENAME COLUMN tipo TO type;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fte_resources' AND column_name='custo_dia') THEN
    ALTER TABLE fte_resources RENAME COLUMN custo_dia TO daily_cost;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fte_resources' AND column_name='data_inicio') THEN
    ALTER TABLE fte_resources RENAME COLUMN data_inicio TO start_date;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fte_resources' AND column_name='data_fim') THEN
    ALTER TABLE fte_resources RENAME COLUMN data_fim TO end_date;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fte_resources' AND column_name='alocacao_pct') THEN
    ALTER TABLE fte_resources RENAME COLUMN alocacao_pct TO allocation_pct;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fte_resources' AND column_name='contrato_id') THEN
    ALTER TABLE fte_resources RENAME COLUMN contrato_id TO contract_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fte_resources' AND column_name='estado') THEN
    ALTER TABLE fte_resources RENAME COLUMN estado TO status;
  END IF;
END $$;

-- ── people (was pessoas) ─────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='people' AND column_name='nome') THEN
    ALTER TABLE people RENAME COLUMN nome TO name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='people' AND column_name='unidade') THEN
    ALTER TABLE people RENAME COLUMN unidade TO org_unit;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='people' AND column_name='perfil') THEN
    ALTER TABLE people RENAME COLUMN perfil TO role;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='people' AND column_name='tipo') THEN
    ALTER TABLE people RENAME COLUMN tipo TO type;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='people' AND column_name='notas') THEN
    ALTER TABLE people RENAME COLUMN notas TO notes;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='people' AND column_name='activo') THEN
    ALTER TABLE people RENAME COLUMN activo TO active;
  END IF;
END $$;

-- ── resources (legacy) ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='nome') THEN
    ALTER TABLE resources RENAME COLUMN nome TO name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='unidade') THEN
    ALTER TABLE resources RENAME COLUMN unidade TO org_unit;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='perfil') THEN
    ALTER TABLE resources RENAME COLUMN perfil TO role;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='alocacao_total') THEN
    ALTER TABLE resources RENAME COLUMN alocacao_total TO total_hours;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='alocacao_projeto') THEN
    ALTER TABLE resources RENAME COLUMN alocacao_projeto TO project_hours;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='periodo_inicio') THEN
    ALTER TABLE resources RENAME COLUMN periodo_inicio TO period_start;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='periodo_fim') THEN
    ALTER TABLE resources RENAME COLUMN periodo_fim TO period_end;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='custo_hora') THEN
    ALTER TABLE resources RENAME COLUMN custo_hora TO hourly_cost;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='notas') THEN
    ALTER TABLE resources RENAME COLUMN notas TO notes;
  END IF;
END $$;
