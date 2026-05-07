# CLAUDE.md — Strategos

## Project Overview

Strategos is a PMO (Project Management Office) dashboard for organizations managing
strategic programs and projects. It provides executive summaries, activity tracking,
Gantt charts, financial execution monitoring, resource management, risk management,
and status reporting — all in a single web application.

## Tech Stack

- **Frontend:** Vite + React 19 + Tailwind CSS v4 + TypeScript
- **Backend/DB:** Supabase (PostgreSQL + Auth + Row Level Security)
- **Hosting:** Cloudflare Pages (auto-deploy from GitHub on push to main)
- **Package manager:** npm
- **Language:** TypeScript (strict mode)

## Repository

- **GitHub:** github.com/MiguelPC90/Strategos
- **Dev repo:** github.com/MiguelPC90/Strategos_SupaBase_Dev (Claude Code workspace)
- **Live URL:** strategos.migcacoelho.workers.dev
- **Branch strategy:** `main` (production), `dev` (development)

## Supabase

- **Project URL:** https://wirokqtgrvlxwvypmbej.supabase.co
- **Credentials:** in `.env.local` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- **Users:** migcacoelho@gmail.com (admin), miguelstrategos@gmail.com (viewer), vasco.candeias97@gmail.com (viewer)

## Project Structure

Each component and page lives in its own folder with a co-located .css file.
Import directly from the component file — no index barrel files.

```
src/
├── components/
│   ├── Badge/         Badge.tsx + Badge.css
│   ├── Card/          Card.tsx + Card.css
│   ├── FilterBar/     FilterBar.tsx + FilterBar.css
│   ├── KpiCard/       KpiCard.tsx + KpiCard.css
│   ├── Layout/        Layout.tsx + Layout.css   ← app shell
│   ├── MultiSelect/   MultiSelect.tsx + MultiSelect.css
│   ├── PageHeader/    PageHeader.tsx + PageHeader.css
│   ├── ProgressBar/   ProgressBar.tsx + ProgressBar.css
│   └── Table/         Table.tsx + Table.css
├── pages/
│   ├── Dashboard/     Dashboard.tsx + Dashboard.css
│   ├── Actividades/   Actividades.tsx + Actividades.css
│   ├── Gantt/         Gantt.tsx + Gantt.css
│   ├── Evolucao/      Evolucao.tsx + Evolucao.css
│   ├── PontoSituacao/ PontoSituacao.tsx + PontoSituacao.css
│   ├── ExecucaoFinanceira/ ExecucaoFinanceira.tsx + ExecucaoFinanceira.css
│   ├── Recursos/      Recursos.tsx + Recursos.css
│   ├── GestaoIniciativas/ GestaoIniciativas.tsx + GestaoIniciativas.css
│   ├── GestaoPDS/     GestaoPDS.tsx + GestaoPDS.css
│   ├── GestaoRiscos/  GestaoRiscos.tsx + GestaoRiscos.css
│   ├── GestaoFinanceira/ GestaoFinanceira.tsx + GestaoFinanceira.css
│   ├── GestaoRecursos/ GestaoRecursos.tsx + GestaoRecursos.css
│   ├── Login/         Login.tsx + Login.css
│   └── Admin/         Admin.tsx (placeholder)
├── hooks/
│   ├── useAuth.ts
│   ├── useRole.ts
│   ├── useActivities.ts
│   ├── usePrograms.ts
│   ├── useEixos.ts
│   ├── usePlanos.ts
│   ├── useSnapshots.ts
│   ├── usePdsEntries.ts
│   ├── useRisks.ts
│   ├── useFinancials.ts
│   ├── useResources.ts
│   └── usePeople.ts
├── context/
│   ├── AuthContext.tsx
│   └── FilterContext.tsx
├── lib/
│   ├── supabase.ts
│   ├── rollup.ts
│   └── markdown.tsx
├── types/
│   └── index.ts
├── App.tsx
├── main.tsx
└── index.css
```

## CSS Rules (CRITICAL for Tailwind v4)

- All component/page CSS files MUST wrap rules in `@layer components { }`
- index.css uses `@layer base { }` for design tokens
- Component CSS imported in each component file: `import './Component.css'`
- Do NOT add component rules to index.css

## Database Schema

### Core hierarchy (dedicated tables):

- `programs` (N0) — id, code, name, sort_order
- `eixos` (N1) — id, program_id → programs (ON DELETE RESTRICT), code, name, sort_order
- `planos` (N2) — id, eixo_id → eixos (ON DELETE RESTRICT), program_id, code, name, owner, sponsor, sort_order

### Activities:

- `activities` — id, level (1-6), name, n0-n6 text, program_id, eixo_id, plano_id → planos (CASCADE)
  - pct, pct_prev: stored as 0-100 (NOT 0-1) — do NOT multiply by 100
  - status: ‘Em dia’ | ‘Em atraso’ | ‘Concluída’
  - bs, bf, rs, rf: baseline/real start/finish dates (ISO strings)
  - source: CHECK (‘act’, ‘gantt’, ‘manual’), DEFAULT ‘manual’, nullable

### Financial:

- `fin_budget_lines` — program_id, plano_id (CASCADE), category, capex, values JSONB
- `fin_contracts` — program_id, plano_id (CASCADE), supplier, amount, currency, exchange_rate
- `fin_invoices` — program_id, plano_id (CASCADE), ref, amount, dates, status
- `cost_categories` — per program, name, is_capex
- `currencies` — code (EUR/USD/AKZ), name, is_default
- `management_years` — per program, year

### PDS & Risks:

- `pds_entries` — program_id, plano_id (CASCADE), 4 JSONB arrays (commitments/progress/next_steps/attention)
- `risks` — program_id, plano_id (CASCADE), description, impact (1-5), probability (1-5), status, mitigation

### Resources & People:

- `fte_resources` — program_id, plano_id (CASCADE), name, type, allocation_pct, dates, daily_cost
- `people` — name, email, company, profile_id (nullable → profiles), org_unit, role

### Auth & Config:

- `profiles` — id, email, full_name, role (admin/gestor/viewer)
- `user_permissions` — user_id, program_id, plan_id → planos (CASCADE), page, access_level
- `app_config` — key-value configuration
- `snapshots` — daily KPI snapshots (kpi, by_n0, by_n1 JSONB), daily_snapshot() cron at 23:59
- `activities_history` — activity_id (SET NULL on delete), preserves history

### Key constraints:

- eixos: RESTRICT (can’t delete with child planos)
- planos: RESTRICT from eixos; CASCADE to all child tables
- activities_history: SET NULL (preserves history)

## Rollup Logic (src/lib/rollup.ts)

- % Exec N6: direct value (editable leaf)
- % Exec N5: average of child N6 (or direct if no children)
- % Exec N4: average of child N5 (or direct if no children)
- % Exec N0-N3: average of ALL descendant N4 values
- % Prev: same pattern using baseline dates
- Status N4-N5: all done→Concluído, any late→Em atraso, else→Em dia
- Status N0-N3: from min(bs)/max(bf) of descendant N4s
- Owner/Sponsor: attributes of plano (N2), not individual activities

## CSS Variables (Theme)

```
--navy: #002E5E  --green: #95BB42  --bg: #fff  --bg2: #f5f6f7  --bg3: #eceef0
--text: #1a1a18  --text2: #5c5c58  --text3: #9c9c96
--border: rgba(0,0,0,0.09)  --border2: rgba(0,0,0,0.16)
--r: 8px  --rl: 12px  --blue: #185FA5  --red: #A32D2D  --amber: #854F0B
--sidebar-w: 220px  --sidebar-w-col: 56px  --topbar-h: 52px
```

## Important Rules

1. Do NOT modify reusable components without checking dependents
1. Always run `npm run build` before committing
1. Portuguese UI labels matching original dashboard
1. No mobile or dark mode until Phase 13
1. pct and pct_prev stored as 0-100 — do NOT multiply by 100
1. All CSS files must use @layer components { }
1. Owner/Sponsor are on planos table, not activities
1. Plan selectors use usePlanos hook (not DISTINCT from activities)
1. Import directly from component files — no barrel exports