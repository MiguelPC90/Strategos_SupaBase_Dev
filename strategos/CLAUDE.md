# CLAUDE.md — Strategos

## Project Overview

Strategos is a PMO (Project Management Office) dashboard for organizations managing strategic programs and projects. It provides executive summaries, activity tracking, Gantt charts, financial execution monitoring, resource management, risk management, and status reporting — all in a single web application.

**Tagline:** *Intelligence driving Strategy*

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
- **Branch strategy:** `main` (production), `claude/add-collaborative-database-LWmWB` (Claude Code dev)

## Supabase

- **Project URL:** https://wirokqtgrvlxwvypmbej.supabase.co
- **Credentials:** in `.env.local` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- **Users:** migcacoelho@gmail.com (admin), miguelstrategos@gmail.com (editor), vasco.candeias97@gmail.com (viewer)

## Brand Identity (v1.0 — locked)

The product is **Stratgos** — without the `e`. The italic *g* 
occupies the place of the missing *e* in the wordmark. The 
typographic quirk IS the brand. Never spell it "Strategos".

### Palette · Nocturne (brand)

- `--stratgos-ink-900: #0B1220` — primary brand · body text · topbar
- `--stratgos-ink-700: #1E2A44` — secondary surface · heading accent
- `--stratgos-ink-500: #475369` — body text alternate · secondary labels
- `--stratgos-ink-300: #8B93A3`
- `--stratgos-ink-100: #D8DCE4` — dividers · disabled states
- `--stratgos-ember:   #C8553D` — accent · links · italic g · CTAs
- `--stratgos-moss:    #5B7A3A` — positive signals · confirmations
- `--stratgos-parchment: #F4F0E8` — page background · documents
- `--stratgos-cream:    #FBF8F2` — card background · modals

### Palette · Semantic (status pills only)

These colours have ONE job each. Must NEVER be used decoratively, 
in marketing, or anywhere outside their semantic role. Brand and 
semantic palettes do not overlap.

- `--status-ontrack: #4A7C59` — "Em dia"
- `--status-late:    #B84A3F` — "Em atraso"
- `--status-done:    #2F5F8F` — "Concluída"
- `--status-risk:    #C89A3C` — "Em risco"

### Hover state

- `--stratgos-ember-dark: #B34B36` — primary button hover, ember-on-hover

### Typography · four faces, one voice

Four typefaces total. Never a fifth.

- `--font-display: 'Instrument Serif'` — wordmark, hero, section 
  titles, pull quotes. Regular only — never bold.
- `--font-serif: 'Fraunces'` — editorial body for brand documents, 
  executive reports, PDS narrative text. Regular + Medium. 
  **Not used in product UI.**
- `--font-sans: 'Inter'` — product UI: dashboards, tables, forms. 
  12–15px. Regular / Medium / Semibold. Never italic in UI.
- `--font-mono: 'JetBrains Mono'` — labels, kickers, metadata, 
  IDs, timestamps. 10–13px. Always tracked (letter-spacing 
  0.12–0.2em) when uppercase.

### Type scale

| Level | Size / line-height | Font / weight |
|---|---|---|
| Display XL | 88 / 0.95 | Instrument Serif |
| Display | 48 / 1.0 | Instrument Serif |
| Headline | 32 / 1.1 | Fraunces |
| Title | 20 / 1.3 | Inter 600 |
| Body L | 18 / 1.5 | Fraunces (editorial only) |
| Body | 15 / 1.55 | Inter 400 |
| Label | 11 / 1.4 | JetBrains Mono uppercase tracked |

### Voice

Two registers, applied by surface:

**Full Stratgos voice** (direct, opinionated, dry) — marketing site, 
landing pages, board-facing reports, sales decks, brand documents.

**Neutral functional voice** (transactional, no personality) — 
product UI labels, buttons, empty states, system messages, errors, 
email notifications, anything the end-user sees while working. 
Reason: in cobrand deployments the customer's logo sits next to 
ours; the product UI is shared infrastructure, not marketing.

Four principles (apply to both registers):
1. Numbers first — lead with the specific fact, then interpretation
2. No exclamation marks — boards don't shout
3. Portuguese-first (European Portuguese, neutral register)
4. Dry over witty — never witty in transactional UI

### Iconography

Lucide / Feather only. Stroke-based, 1.5px, rounded caps and joins. 
Optically aligned to a 24×24 grid. Monochrome (ink-900 or cream). 
Ember accent only for active/selected states. Never filled, never 
multi-colour, never gradients, never mixed icon libraries.

### Cobranding (deferred — three modes, future feature)

Stratgos ships into customer environments. Three modes governed by 
`app_config.branding.mode`:

- `stratgos` — Stratgos-only (default for marketing, demo, 
  single-tenant)
- `cobrand` — italic g mark + 1px divider + customer logo + 
  customer name (default for customers)
- `whitelabel` — customer logo only, "powered by Stratgos" footer 
  (premium tier; non-negotiable footer protects the brand)

The ink-900 topbar is shared infrastructure. Never customisable 
to client colours. Logo goes ON it, not behind it.

### Authority of this section

This section is the source of truth. When a request conflicts with 
brand guidance here, follow this section and flag the conflict 
back to the user before proceeding. Examples:

- "Make the topbar blue" → conflict (topbar is always ink-900); 
  flag and ask
- "Use red for status" → conflict (red is reserved for late status); 
  use --status-late
- "Add a green button" → conflict if green is brand decoration 
  (use moss); not conflict if it's confirmation semantic (use 
  status-ontrack)

## Project Structure

```
src/
├── components/
│   ├── Badge/         Card/         FilterBar/     KpiCard/
│   ├── Layout/        Modal/        MultiSelect/   PageHeader/
│   ├── ProgressBar/   Spinner/      Table/         Toast/
│   ├── Breadcrumb/    ← Apr 2026: filter breadcrumb with + Filtros popup
│   ├── DateRangePicker/ ← Apr 2026: reusable date range widget
│   ├── EmptyState/    ← Apr 2026: 7 icon variants Lucide-style
│   ├── SplashScreen/  ← Apr 2026: initial load logo with pulse animation
├── context/
│   ├── AuthContext.tsx  FilterContext.tsx  ToastContext.tsx
├── pages/
│   ├── Dashboard/     Actividades/    Gantt/          Evolucao/
│   ├── PontoSituacao/ ExecucaoFinanceira/  Recursos/
│   ├── GestaoIniciativas/  GestaoPDS/    GestaoRiscos/
│   ├── GestaoFinanceira/   GestaoRecursos/
│   ├── Login/         Admin/
├── hooks/
│   ├── useAuth.ts       useRole.ts        usePermissions.ts
│   ├── useActivities.ts useProgramas.ts   useEixos.ts  usePlanos.ts
│   ├── useSnapshots.ts  usePdsEntries.ts  useRisks.ts
│   ├── useFinancials.ts useResources.ts   usePeople.ts
│   ├── useActivityDependencies.ts  ← Apr 2026: CRUD + getPredecessors/getSuccessors
├── lib/
│   ├── supabase.ts
│   ├── rollup.ts          ← status + pct rollup engine
│   ├── riskColors.ts      ← shared 5-level risk gradient
│   ├── healthRules.ts     ← PDS health semaphore engine
│   ├── invoiceHelpers.ts  ← invoice status styles + alert logic
│   ├── activityDependencies.ts  ← Apr 2026: cycle/date validation + BFS propagation
│   ├── tokens.ts          ← Apr 2026: Stratgos brand tokens for JS/TS (Recharts)
│   └── markdown.tsx
├── types/index.ts
├── App.tsx   main.tsx   index.css
```

-----

## 🎨 Stratgos v1.0 Brand System (Apr 2026)

### Primary Palette · Nocturne

|Token                 |Value    |Role                                            |
|----------------------|---------|------------------------------------------------|
|`--stratgos-ink-900`  |`#0B1220`|Primary brand · body text · **topbar**          |
|`--stratgos-ink-700`  |`#1E2A44`|Secondary surface · **sidebar** · heading accent|
|`--stratgos-ink-500`  |`#475369`|Body text alternate · secondary labels          |
|`--stratgos-ink-300`  |`#8B93A3`|Tertiary text · placeholders                    |
|`--stratgos-ink-100`  |`#D8DCE4`|Dividers · disabled states                      |
|`--stratgos-ember`    |`#C8553D`|**Accent · links · CTAs**                       |
|`--stratgos-moss`     |`#5B7A3A`|Positive signals · ✓ confirmations              |
|`--stratgos-parchment`|`#F4F0E8`|**Page background**                             |
|`--stratgos-cream`    |`#FBF8F2`|**Card / modal background**                     |

### Semantic Palette (status pills + status-driven charts ONLY)

> “Semantic and brand colours must not overlap.”

|Token             |Value    |Usage            |
|------------------|---------|-----------------|
|`--status-ontrack`|`#4A7C59`|“Em dia”         |
|`--status-late`   |`#B84A3F`|“Em atraso”      |
|`--status-done`   |`#2F5F8F`|“Concluída”      |
|`--status-risk`   |`#C89A3C`|“Risco” / warning|

### Typography

- `--font-display`: Instrument Serif / Fraunces / Georgia serif
- `--font-serif`: Fraunces / Iowan Old Style / Georgia serif
- `--font-sans`: Inter / system-ui sans-serif
- `--font-mono`: JetBrains Mono / ui-monospace

Body: Inter 14px 400. Headings: Fraunces 600. Links: Ember.

### Legacy Aliases

Old tokens (`--navy`, `--bg`, `--red`, `--amber`, `--green`, `--text`, `--border`, etc.) are mapped to Stratgos tokens via `:root` aliases. No refactoring of component CSS was required when the brand was applied.

-----

## CSS Rules (CRITICAL for Tailwind v4)

- All component/page CSS files MUST wrap rules in `@layer components { }`
- index.css uses `@layer base { }` for design tokens
- index.css also has `@layer components { }` with global utilities: `.styled-select`, `.styled-select-sm`, `.status-pill`
- Component CSS imported in each component file: `import './Component.css'`
- Do NOT add page-specific rules to index.css

## Global Utility Classes

Use these shared utilities instead of page-specific implementations:

- `.styled-select` — page-level selectors (Programa, Plano, Ano)
- `.styled-select-sm` — compact selects inside modals and table rows
- `.status-pill` — 88px min-width pill for all status badges
- `.gi-btn-secondary` — outlined navy button (e.g. “Novo Plano”)

-----

## Database Schema

### Core hierarchy (dedicated tables):

- `programs` (N0) — id, code, name, sort_order
- `eixos` (N1) — id, program_id → programs (ON DELETE RESTRICT), code, name, sort_order
- `planos` (N2) — id, eixo_id → eixos (RESTRICT), program_id, code, name, owner, sponsor, sort_order
  - **Apr 2026:** added `start_date date, end_date date, objective text`

### Activities:

- `activities` — id, level (1-6), name, n0-n6 text, program_id, eixo_id, plano_id → planos (CASCADE)
  - pct, pct_prev: stored as 0-100 (NOT 0-1) — do NOT multiply by 100
  - status: ‘Em dia’ | ‘Em atraso’ | ‘Concluída’
  - bs, bf, rs, rf: baseline/real start/finish dates (ISO strings)
  - source: CHECK (‘act’, ‘gantt’, ‘manual’), DEFAULT ‘manual’, nullable
  - Trigger: sync_plano_id() — auto-populates plano_id from n2 name on INSERT/UPDATE

### Activity Dependencies (Apr 2026):

- `activity_dependencies` — id, successor_id → activities (CASCADE), predecessor_id → activities (CASCADE), dep_type CHECK IN (‘FS’,‘SS’,‘FF’,‘SF’), lag_days integer DEFAULT 0, created_at, created_by
  - UNIQUE (successor_id, predecessor_id)
  - CHECK (successor_id != predecessor_id)
  - Indices on both FKs
  - RLS: admin/editor can write, all authenticated can read
  - Only leaves (level >= 4) can have dependencies (enforced in lib)

### Financial:

- `fin_budget_lines` — program_id, plano_id (CASCADE), category, capex, values JSONB
- `fin_contracts` — program_id, plano_id (CASCADE), supplier, amount, currency, exchange_rate, end_date
- `fin_invoices` — program_id, plano_id (CASCADE), contract_id → fin_contracts, ref, amount, issue_date, due_date, payment_date, status
  - **CHECK constraint:** status IN (‘Prevista’, ‘Recebida’, ‘Aprovada’, ‘Paga’, ‘Rejeitada’)
- `cost_categories` — name, is_capex (program association via cost_category_programs)
- `cost_category_programs` — category_id → cost_categories (CASCADE), program_id → programs (CASCADE)
- `currencies` — code (EUR/USD/AKZ), name, symbol, is_default
- `management_years` — per program, year

### PDS & Risks:

- `pds_entries` — program_id, plano_id (CASCADE), n0, n1, plan_name, 4 JSONB arrays (commitments/progress/next_steps/attention)
- `risks` — program_id, plano_id (CASCADE), description, impact (1-N), probability (1-N), status, mitigation

### Resources & People:

- `fte_resources` — program_id, plano_id (CASCADE), name, type, allocation_pct, dates, daily_cost
  - **Apr 2026:** added `person_id uuid REFERENCES people(id) ON DELETE SET NULL` with index
- `people` — name, email, company, profile_id (nullable → profiles), org_unit, role, type (‘Interno’/‘Externo’), active

### Auth & Config:

- `profiles` — id, email, full_name, role (admin/editor/viewer)
- `user_permissions` — user_id, program_id, plan_id → planos (CASCADE), page, access_level
- `app_config` — config_key, data (JSONB text), updated_at, updated_by
- `snapshots` — daily KPI snapshots (kpi, by_n0, by_n1 JSONB), daily_snapshot() cron at 23:59
  - Uses UUID keys, counts only level=4, includes conc_a_data_denom
- `activities_history` — activity_id (SET NULL on delete), preserves history

### Key constraints:

- eixos: RESTRICT (can’t delete with child planos)
- planos: RESTRICT from eixos; CASCADE to all child tables
- activities_history: SET NULL (preserves history)
- fin_invoices: contract_id → fin_contracts (nullable FK), status CHECK constraint
- activity_dependencies: CASCADE on both FKs, UNIQUE pair, no self-reference

-----

## app_config keys

### UI & Global:

- `client_title`, `client_subtitle`, `client_logo_url` — topbar customisation
- `cutoff_date` — data de corte global
- `filter_labels_{programId}` — JSON: {“n1”: “…”, “n2”: “…”, “owner”: “…”, “sponsor”: “…”}

### Rollup thresholds:

- `status_delay_threshold_aggregates` — integer 0-100 (default 20) — for N0-N3 status
- `status_delay_threshold_leaves` — integer 0-100 (default 0) — for N4-N6 status
- Fallback chain: new key → legacy `status_delay_threshold` → hardcoded default
- Loaded at startup in Layout.tsx via `setThresholds(aggregates, leaves)`

### PDS:

- `pds_hide_completed_days` — integer (default 90) — hide completed commitments older than X days
- `health_rules` — JSONB: HealthConfig with red/amber blocks, OR/AND operators, enabled toggles per metric

### Risks:

- `risk_matrix_size` — “3”, “4”, “5”, or “6”
- `risk_thresholds` — JSONB: {very_low, low, medium, high} — 5-level gradient thresholds
- `risk_states` — JSON array of strings (Aberto, Em mitigação, Fechado, etc.)

### Invoices (Admin → Financeiro → Alertas):

- `invoice_alert_overdue` — integer (default 100) — % of due term (issue→due) to classify as overdue
- `invoice_alert_due_soon` — integer (default 85) — % of due term to classify as due soon

### Resources:

- `resource_profiles` — JSON array of strings (PM, Developer, Analista, etc.)
- `org_units` — JSON array of strings (TI, Negócio, etc.)

-----

## Shared Libraries

### src/lib/rollup.ts

Threshold-driven status and percentage rollup engine.

**Exports:**

- `setThresholds(aggregates, leaves)` — set both thresholds at app startup
- `leafStatus(activity, today?)` — status for N4-N6 leaves
- `rollupStatus(leaves, today?)` — status for N0-N3 aggregates
- `leafPctPrev(activity, today?)` — computed expected % from baseline dates
- `rollupPct(leaves)`, `rollupPctPrev(leaves, today)` — aggregate percentages

**leafStatus (N4-N6) rules:**

1. pct >= 100 → ‘Concluída’
1. today > bf AND pct < 100 → ‘Em atraso’
1. pct < pct_prev - THRESHOLD_LEAVES → ‘Em atraso’
1. else → ‘Em dia’

**rollupStatus (N0-N3) rules:**

- Uses (pct_prev - pct) > THRESHOLD_AGGREGATES to determine delay
- Date-based: today > max(bf of N4s) AND avg pct < 100 → ‘Em atraso’

**KPI calculations (always based on level === 4 only):**

- % Exec: AVG(pct) of N4 leaves
- Concretização geral: concluídas / total N4
- Concretização à data: concluídas / (concluídas + em_atraso)
- N5/N6 are detail records — NEVER included in any aggregation

### src/lib/riskColors.ts

Shared 5-level risk severity gradient used across PDS, GestaoRiscos, and Admin preview.

**Exports:**

- `gradeStyle(grade, size, thresholds?)` — returns {bg, color, border}
- `gradeLabel(grade, size, thresholds?)` — returns ‘Muito Baixo’ / ‘Baixo’ / ‘Médio’ / ‘Alto’ / ‘Crítico’
- `DEFAULT_THRESHOLDS` — {very_low: 5, low: 9, medium: 12, high: 17}
- Interface `RiskThresholds`, `GradeStyle`

**Color gradient:**

- Muito Baixo: #4a9e3f (dark green)
- Baixo: #8cc63f (yellow-green)
- Médio: #f5c542 (yellow/amber)
- Alto: #f5943a (orange)
- Crítico: #e85c4a (soft red)

### src/lib/healthRules.ts

Configurable health evaluation engine for PDS semaphore.

**Exports:**

- `computeHealth(input, config)` — returns {level, reasons}
- `DEFAULT_HEALTH_CONFIG`
- `HEALTH_METRIC_LABELS` — human labels for UI
- Types: `HealthMetric`, `HealthRule`, `HealthBlock`, `HealthConfig`, `HealthInput`

**Metrics:**

- `exec_delay` — (pct_prev - pct) in pp
- `delayed_pct` — % of leaves in ‘Em atraso’
- `critical_risks` — count of risks with grade > thresholds.high
- `high_risks` — count with grade > thresholds.medium
- `attention_open` — count of open ‘Pontos de Atenção’ items

**Rule structure:** each rule has `enabled` flag and `threshold`. Block operator is OR or AND. Each color (red, amber) has independent block config.

### src/lib/invoiceHelpers.ts

Invoice status styling and alert classification.

**Exports:**

- `invoiceStatusStyle(status)` — returns {bg, color, label}
- `invoiceTermPct(issue_date, due_date)` — % of due term elapsed
- `invoiceAlert(invoice, thresholds)` — returns ‘overdue’ | ‘due_soon’ | null
- Types: `InvoiceStatus`, `InvoiceAlert`, `InvoiceAlertThresholds`

**5 canonical invoice states:**

- ‘Prevista’ — grey (forecast, not yet issued)
- ‘Recebida’ — blue (issued, awaiting approval)
- ‘Aprovada’ — amber (approved, awaiting payment)
- ‘Paga’ — green (paid)
- ‘Rejeitada’ — red (rejected/disputed)

**Alert logic:** only unpaid (not Paga, not Rejeitada) invoices with both issue_date and due_date are classified. Uses `(today - issue) / (due - issue) × 100` to compute the elapsed percentage.

### src/lib/activityDependencies.ts (Apr 2026)

Dependency graph validation and date propagation engine.

**Exports:**

- `wouldCreateCycle(predId, sucId, existingDeps)` — DFS cycle detection
- `validateDependencyDates(pred, suc, depType, lag)` — FS/SS/FF/SF rules
- `propagateDateChanges(changed, all, allDeps)` — BFS cascade returning `Map<id, {bs, bf}>`
- `canHaveDependencies(activity)` — level >= 4
- `validateNewDependency(...)` — full validation (self/non-leaf/dup/cycle/dates)
- Types: `DependencyType`, `ActivityDependency`, `DependencyValidationError`

**Error codes (priority order):**

1. SELF_DEPENDENCY
1. NON_LEAF (must be level >= 4)
1. DUPLICATE
1. CYCLE
1. DATE_VIOLATION

**Dependency types:**

- FS — Finish-Start (successor starts after predecessor finish + lag)
- SS — Start-Start (successor starts after predecessor start + lag)
- FF — Finish-Finish (successor finishes after predecessor finish + lag)
- SF — Start-Finish (successor finishes after predecessor start + lag)

### src/lib/tokens.ts (Apr 2026)

JS/TS source of truth for brand colors. Mirrors CSS :root variables. Used by Recharts and inline JSX styles.

**Exports:**

- `colors.brand.*` — ink900/700/500/300/100, ember, emberDark, moss, parchment, cream
- `colors.status.*` — ontrack, late, done, risk
- `colors.neutral.*` — white, gridLine, axisLabel
- `statusColor(key)` — semantic helper: ‘ontrack’ | ‘late’ | ‘done’ | ‘risk’ → hex
- `chartPalette` — multi-series array (ink700, ember, moss, ink500, risk, done)
- `chartDefaults` — gridStroke, axisStroke, axisTickColor, tooltipBg, tooltipBorder, tooltipText
- `riskGradeColors` — 5-level risk mapping

**Rule:** Charts NEVER hardcode hex values. Always import from tokens.ts.

-----

## Reusable Components (Apr 2026)

### DateRangePicker

Compact trigger + popup with 2 native date inputs + shortcuts.

**Props:** `startDate, endDate, onChange, required, label, error, minDate, maxDate, size ('sm'|'md'), allowClear, placeholder, disabled`

**Behavior:** Closes on outside click / Escape (cancel behavior — only “Aplicar” fires onChange). Shortcuts: “Este mês” / “Trimestre” / “Este ano”. End date min is locally clamped to start date.

### EmptyState

Applied to all 12 pages for empty data states.

**Props:** `icon ('data'|'list'|'target'|'inbox'|'chart'|'calendar'|'folder'), title, description, actionLabel, onAction, actionHref, size`

**Icons:** Inline SVG in Lucide style, stroke-based, uses `currentColor` inheriting from text3 at 50% opacity.

### SplashScreen

On initial app load.

**Behavior:** Logo centered with pulse animation (1.8s loop), fade-out 300ms. Minimum 500ms visibility (anti-flicker). Anonymous users only wait for auth check; authenticated users wait for auth + app_config + programs. Integrated in Layout.tsx.


### Breadcrumb (Parallel Filters)

Persistent filter UI below topbar (hidden on /admin).

**Structure:** 3 parallel dropdowns always visible — Programa · Eixo · Plano. Default "Todos". Plus chips for secondary filters (Status, Owner, Sponsor) + "+ Filtros" button that opens popup with checkboxes.

**Behaviour:**
- Parent selected → children restricted to parent's children (hard lock, clears children)
- Child selected → parents auto-fill silently, remain editable
- Cross-navigation via child: selecting Plano from another Programa recalculates Programa + Eixo
- Middle level changed to another parent → top auto-updates, bottom clears
- Options bounded by `accessibleProgramIds` for current page even when Programa=Todos
- `trySetProgram()` guards programmatic selection, shows toast "Sem acesso a este programa"
- sessionStorage persistence (resets on new tab)

**Rule:** Breadcrumb is the SINGLE source of truth for filter UI. Topbar has NO filter icon.

**FilterContext API:** uses `filters.programIds[0]`, `filters.n1Values[0]`, `filters.n2Values[0]`, `setFilter(key, value)`.


### DeviationBar (inline in Dashboard.tsx)

Mini progress bar with target marker for real vs target comparisons.

**Rendering:** Bar fills from 0 to `actual`. Vertical 2px marker line at `target` position. Colors: Moss fill at 0.8 opacity when on-target (actual >= target), vibrant Late red when off-target.

**Display:** “{actual}% / {target}% target” below bar.

-----

## Custom Hooks

- `useActivities(programId?)`, `usePlanos(programId?)`, `useEixos(programId?)`, `usePrograms()`
- `useActivityDependencies()` (Apr 2026) — `{ dependencies, loading, error, reload, createDependency, updateDependency, deleteDependency, getPredecessors, getSuccessors }`
  - `updateDependency` typed to only `dep_type | lag_days` (prevent accidental ID/FK mutations)
- `useFilter()` — `{ filters, setFilter, clearAll }`
  - `filters.programIds[]`, `n1Values[]`, `n2Values[]`, `statuses[]`, `owners[]`, `sponsors[]`

-----

## Toast System

Use the global toast system — never create local toast state:

```typescript
import { useToast } from '../../context/ToastContext'
const { showToast } = useToast()

showToast('Guardado!', 'success')
showToast('Eliminado.', 'info')
showToast('Erro: ' + error.message, 'error')
showToast('Aviso importante', 'warning')
```

## Modal Component

Use the global Modal component for all forms/dialogs:

```typescript
import Modal from '../../components/Modal/Modal'
<Modal isOpen={open} onClose={() => setOpen(false)} title="Título"
  footer={<><button onClick={handleSave}>Guardar</button></>}>
  {/* form content */}
</Modal>
```

## Collapsible Sections in Modals

Use the Collapsible inline component pattern for expandable sections (e.g. Responsável/Sponsor, Notas, Dependências in GestaoIniciativas modal):

```tsx
<Collapsible title="Dependências">
  {/* content */}
</Collapsible>
```

-----

## Permissions System (RLS + Frontend)

### Roles

- **admin** — bypasses all checks. Sees and edits everything.
- **editor** — edits only what's in the matrix with `access_level = 'edit'`.
- **viewer** — read-only always, even with a matrix row marked 'edit'.

UI labels: "Admin" | "Gestor" | "Visualizador" (Portuguese).

### Matrix (user_permissions)

Per-user × per-program × per-page with `access_level` ('view' or 'edit').

Page keys stored: dashboard, actividades, gantt, ponto-situacao, exec-financeira, recursos, evolucao, gestao-iniciativas, gestao-pds, gestao-riscos, gestao-financeira, gestao-recursos.

### DB enforcement (RLS)

**Helper functions:**
- `user_has_program_access(program_id)` — any row for program OR admin
- `user_can_edit_program_page(program_id, page)` — row with access_level='edit' OR admin

**Scoped tables (7 with program_id):**
- activities, eixos, planos, pds_entries, risks, fin_budget_lines, fin_invoices
- SELECT policy: `user_has_program_access`
- INSERT/UPDATE/DELETE policy: `user_can_edit_program_page` with table-specific page key:
  - activities/eixos/planos → 'gestao-iniciativas'
  - pds_entries → 'gestao-pds'
  - risks → 'gestao-riscos'
  - fin_budget_lines/fin_invoices → 'gestao-financeira'

**Admin-only writes:** programs, user_permissions, alert_rules.

### Frontend enforcement

**Hooks:**
- `usePermissions()` — `hasAccess(page, programId?)`, `canEdit(page, programId?)`
  - Deny-by-default: zero permissions → returns false
  - Viewer gate: role='viewer' → canEdit always false
  - hasAccess with explicit programId: returns false if no matching row (no fallthrough)
- `useAccessiblePrograms(page?)` — programs where user has access to the page
  - Admin short-circuit (returns all)
  - Non-gestão pages return all programs (access checked via PageGuard)
- `useCanEditCurrent(page)` — derived from FilterContext selection; true only if user can edit in ALL selected programs

**Page-aware filtering (Phase 5):**
- Breadcrumb uses `useAccessiblePrograms(currentRoute)`
- Eixo/Plano dropdowns bounded by accessibleProgramIds even when Programa=Todos
- Auto-reset of programIds when they become inaccessible
- Read-only badge "· apenas leitura" on gestao-* routes when user can't edit
- All 5 gestão pages hide edit/create/delete buttons + disable inputs when read-only
- Evolução migrated to FilterContext (was using independent state)

### Admin UI gates

- Matrix dropdown: 'edit' option only rendered for editor profiles (viewer can only receive view/—)
- Role change editor→viewer: modal warns with edit-row count, converts them to view on confirm
- Admin UI also aligned: key mismatch `execucao-financeira` → `exec-financeira` fixed across the code

-----

## CSS Variables (Theme)

Legacy aliases (all mapped to Stratgos tokens):

```
--navy: #0B1220 (ink-900 topbar) / #1E2A44 (ink-700 sidebar)
--bg: #F4F0E8 (parchment page background)
--bg2: #FBF8F2 (cream card background)
--bg3: #EDE7D8 (slightly darker variant)
--text: #0B1220   --text2: #475369   --text3: #8B93A3
--border: #D8DCE4   --border2: #B8BFCC
--r: 8px   --rl: 12px
--red: #B84A3F (status-late)   --amber: #C89A3C (status-risk)   --green: #4A7C59 (status-ontrack)
--blue: #2F5F8F (status-done)
--blue-bg, --green-bg, --red-bg, --amber-bg — tint tokens
--sidebar-w: 220px   --sidebar-w-col: 56px   --topbar-h: 52px
```

-----

## Testing Workflow

1. User works on iPad during the day (no terminal access)
1. Claude Code executes prompts and commits to dev branch
1. User tests at end of day on Mac:
   
   ```bash
   cd /tmp
   git clone --no-checkout https://github.com/MiguelPC90/Strategos_SupaBase_Dev.git temp-sync
   cd temp-sync
   git checkout claude/add-collaborative-database-LWmWB
   cp -r strategos/src ~/Strategos/strategos/
   cd ~/Strategos/strategos
   rm -rf /tmp/temp-sync
   npm run dev
   ```
1. If approved, merge to main:
   
   ```bash
   git checkout main
   git merge claude/add-collaborative-database-LWmWB
   git push
   ```
   
   Cloudflare auto-deploys.

-----

## Important Rules

1. Do NOT modify reusable components without checking dependents
1. Always run `npm run build` before committing — 0 errors required
1. Portuguese UI labels matching original dashboard
1. No mobile or dark mode until Phase 13 (tokens prepared for dark mode)
1. pct and pct_prev stored as 0-100 — do NOT multiply by 100
1. All CSS files must use `@layer components { }`
1. Owner/Sponsor are on planos table, not activities
1. Plan selectors use usePlanos hook (not DISTINCT from activities)
1. Import directly from component files — no barrel exports
1. Use global toast system (useToast) — never local toast state
1. Use global Modal component — never custom modal implementations
1. KPI calculations always based on level === 4 activities only
1. Use shared libs (rollup, riskColors, healthRules, invoiceHelpers, activityDependencies, tokens) — never duplicate logic
1. Use `.styled-select` / `.styled-select-sm` / `.status-pill` for consistency
1. Invoice status must be one of the 5 canonical states (DB CHECK enforces)
1. Role in DB is ‘editor’, displayed as “Gestor” in UI
1. **Brand colors in CSS** — use Stratgos tokens directly; legacy aliases mapped
1. **Brand colors in JS** — import from `src/lib/tokens.ts`; use `statusColor()` for status-driven
1. **Charts never hardcoded colors** — always via tokens.ts
1. **Semantic vs brand never mix** — status pills use `--status-*`, brand UI uses `--stratgos-*`
1. **Topbar background** is `--stratgos-ink-900` (NOT ink-700)
1. **CTAs** use `--stratgos-ember` (terracotta)
1. **Page background** is `--stratgos-parchment`
1. **Card/modal background** is `--stratgos-cream` (lighter than parchment)
1. **Breadcrumb is the ONLY filter UI** — topbar has no filter icon; secondary filters via “+ Filtros” popup
1. **Dependencies only on leaves (level >= 4)** — `canHaveDependencies()`
1. **Date propagation auto** — `propagateDateChanges` on activity save when dates changed
1. **Cycles impossible** — `wouldCreateCycle` blocks dep creation
1. **Breadcrumb FilterContext API** — `filters.programIds[0]` / `n1Values[0]` / `n2Values[0]`, `setFilter(key, value)`
1. **Activity `level` starts at 0** — Programa=0, Eixo=1, Plano=2, Macro=3, Actividade=4, Sub=5, Detalhe=6
1. **Plano as standalone entity** — separate table; `sync_plano_id()` trigger maintains consistency
1. **Secondary buttons** — `.gi-btn-secondary` (outlined navy) for “Novo Plano”, etc.
1. **Search preserves hierarchy** — matches show ancestors for context
1. **Splash screen mandatory** — on initial load, min 500ms
1. **Empty states for all pages without data** — use EmptyState component

-----

## Claude Code Tips

- Always run `npm run build` before finishing — 0 errors required
- Respect existing patterns — adapt to actual API (`setFilter` not `setFilters`)
- “Keep intact” sections mean DO NOT touch those files/features
- React 19 + JSX transform — no need to `import React`
- Tailwind v4 — use CSS `@layer components` for reusable classes
- Show SQL migrations at top of response if schema changes needed
- Brand audit output — when touching colors, report what was changed
- Adapt variable/property names to match actual codebase when unsure