# Stratgos — Migration Roadmap

> **Stratgos turns strategic plan execution into clear, actionable intelligence.**
> *Strategy made visible*

-----

## How to use this document

This `TODO.md` plays two roles:

**1. Narrative changelog** — `Session updates` sections record, in chronological order, what was done in each session (commits, decisions, lessons). Old content is not deleted: it serves to reconstruct context.

**2. Roadmap** — sections like `Pending`, `Loose ends`, `Phase 13.x`, `Phase 14`, `Phase 15` list what’s left to do, grouped by theme and priority.

**Relationship with `CLAUDE.md`:**

- **`CLAUDE.md`** is the living technical manual (current state: stack, schema, libraries, conventions, known issues). Snapshot, no history.
- **`TODO.md`** (this file) is the narrative changelog + roadmap. Preserves history.

**Golden rule:** when something changes in the system, update `CLAUDE.md` (state) **and** add a chronological note here (history). If one of them lags behind, they will eventually drift apart.

**Language convention:** prose in English; PT-PT preserved for product domain terms (`Plano`, `Eixo`, `Actividade`, PDS, etc.) with inline English translation on first occurrence per section, and for UI strings cited literally between quotes. Historical sessions written before May 2026 retain their original PT-PT prose by design — passé reconstruction is not worth the cost.

**Sync nuance between repos:** the `TODO.md` in the `_Dev` repo (`Strategos_SupaBase_Dev`) is edited by Claude Code; the `TODO.md` in the `Strategos` repo (Mac) may diverge. The `cp -r src` sync does not include root files. Reconcile manually when both sides edit.

-----

## Stack

- **Frontend:** Vite + React 19 + Tailwind CSS v4 + TypeScript
- **Backend/DB:** Supabase (PostgreSQL + Auth + Row Level Security)
- **Hosting:** Cloudflare Pages (auto-deploy from GitHub `main`)
- **Dev branch:** `claude/add-collaborative-database-LWmWB` (Claude Code)
- **Repo (Mac):** github.com/MiguelPC90/Strategos
- **Repo (Claude Code):** github.com/MiguelPC90/Strategos_SupaBase_Dev
- **Live webapp:** strategos.migcacoelho.workers.dev
- **Live landing:** stratgos.com

> **Note on naming:** the product is **Stratgos** (without the `e`). Repository, working directory, Cloudflare worker URL, and `package.json` still use “Strategos” — handled in Phase 13.6 Phase B of the rename.

-----

## Phase 1–3 — Infrastructure ✅

- [x] Layout, sidebar, topbar, routing
- [x] Authentication (email + password, magic link, ProtectedRoute)
- [x] Data layer (types, hooks, FilterContext, permissions)
- [x] Database schema (20+ tables with RLS)
- [x] TypeScript migration, folder-per-component

-----

## Phase 4 — Dashboard (Resumo Executivo / Executive Summary) ✅

- [x] KPIs (`Total`, `Concluídas` / done, `Em dia` / on track, `Em atraso` / late)
- [x] `Indicadores de Concretização` (delivery indicators — actual vs target)
- [x] Bar chart by `Eixo` (axis), donut chart (global status)
- [x] Evolution line chart with metric selector
- [x] Detail table with green target columns
- [x] Trend arrows, totals row, click-to-navigate
- [x] Sticky filter bar with removable chips
- [x] Bar chart grouped by program with label below group
- [x] Table toggle: `Programa` / `Eixo` / `Plano de Acção` (action plan)
- [x] Independent re-renders per component
- [x] `Concretização à Data` (delivery-to-date) formula: `concluídas / (concluídas + em_atraso)`
- [x] **Detail table deviation-first redesign (April 2026):** 6 pair columns → 3 `DeviationBar` columns with target marker (Moss on-target, Late off-target)

-----

## Phase 5 — Activities ✅

- [x] Hierarchical tree (N0 → N6), expand / collapse
- [x] Status badges, dual progress bars
- [x] Summary KPI row, filter integration
- [x] N0 program group header row
- [x] Progress bars same thickness (real and target)
- [x] Real bar color = `var(--red)`

-----

## Phase 6 — Gantt ✅

- [x] Baseline vs real bars, 3 scales (`Semana` / `Mês` / `Trimestre` — Week / Month / Quarter)
- [x] Single sticky column, navy header, compact toolbar
- [x] Filler column, today line (amber), tooltip
- [x] N0 program group header row
- [x] N3 duplicate rows fixed
- [x] Enhanced tooltip with formatted dates, auto-flip, aggregates
- [x] Level selector (`Programa` / `Eixo` / `Plano` / `Actividade`)
- [x] **Activity dependency arrows (April 2026):** SVG overlay with FS / SS / FF / SF orthogonal paths and arrowheads

-----

## Phase 7 — Ponto de Situação / Status Report (PDS) ✅

- [x] Plan selector with `.styled-select`
- [x] 3 KPI cards at the top (`Dados Gerais` / general data + `Indicadores` / indicators + `Riscos` / risks)
- [x] Structured item list (text + date `dd/mm/yyyy` + semantic badge)
- [x] Item counter per section
- [x] Plain-text fallback for `Avanços` (progress) / `Atenção` (attention)
- [x] Auto-transition `Próximos Passos` (next steps) → `Compromissos Anteriores` (past commitments)
- [x] Hide old completed (configurable, default 90 days)
- [x] `Pontos de Atenção` (attention points) visual differentiation (red border)
- [x] Semantic status badges with `displayStatus()` helper
- [x] Always show structure with empty per-section messages
- [x] Health semaphore header (configurable rules)
- [x] Plan navigation arrows with `Alt+←/→` shortcuts
- [x] Risks card: heatmap + interactive table
- [x] Risk matrix with configurable 5-level thresholds
- [x] Risk KPIs card (`Total` / `Críticos` / `Abertos` / `Mitigados` — total / critical / open / mitigated)
- [x] Fixed-width grade badges (72px min-width)
- [ ] Side-by-side PDS comparison
- [ ] Export PDS to PDF
- [ ] Apply deviation-first pattern to activity tables

-----

## Phase 8 — Financial Execution ✅

- [x] 5 KPIs, CAPEX / OPEX donut, monthly stacked bar
- [x] `Rubrica` (line item) + contracts tables
- [x] Plan + CAPEX / OPEX + year filters
- [x] Dynamic currency symbol from Admin
- [x] **Full redesign (April 2026):**
  - 4-zone filter bar (`Programa` / `Plano` multi / `Ano` multi / type toggle)
  - Hierarchical KPIs (3 large + 3 small with alert badges)
  - 5 charts: `Visão Geral` (overview) / CAPEX-OPEX donut / `Execução Mensal` (monthly execution) / `Burn Rate` / `Top Fornecedores` (top suppliers)
  - Tabs `Rubricas` / `Contratos` (line items / contracts) with sortable columns
  - 5 invoice states unified (`Prevista` / `Recebida` / `Aprovada` / `Paga` / `Rejeitada` — forecast / received / approved / paid / rejected)
  - Alert logic (overdue / due_soon) configurable in Admin
- [ ] CAPEX / OPEX breakdown per plan
- [ ] Rethink consolidated program view with drill-down

-----

## Phase 9 — Resources ✅

- [x] 5 KPIs, view by plan, view by resource (heatmap)
- [x] Side panel, period filter, plan selector
- [x] Dynamic currency symbol from Admin
- [x] **Full redesign (April 2026):**
  - New filters (`Programa` + `Plano` multi + `Ano` multi)
  - 3 large KPIs (`Recursos únicos` / unique resources, `FTE médio` / average FTE, `Custo total` / total cost) + 3 small
  - FTE Evolution line + `Internos / Externos` (internal / external) donut
  - Tabs (`Por Plano` / `Por Recurso` / `Lista Completa` — by plan / by resource / full list)
  - Heatmap 5-level gradient with rich tooltip
  - Cross-program overallocation detection (`personKey` + global alloc map)
  - Sortable `Lista Completa` (10 columns) with totals row
- [ ] Resource ending alerts visual (30 days)

-----

## Phase 10 — Evolution ✅

- [x] 2 line charts (`execução` / execution + `concretização` / delivery)
- [x] Comparison table replacing bottom charts
- [x] Delta KPIs, date range selector
- [x] `Concretização à Data` formula fixed
- [ ] Flexible snapshot A vs B comparison
- [ ] Apply deviation-first pattern to comparison table

-----

## Phase 11 — Management Pages ✅

- [x] 11a: `Gestão de Iniciativas` (initiatives management — hierarchy, modal, cascading level selector)
- [x] 11b: `Gestão PDS` (PDS management — 4 sections, B/I formatting, items CRUD)
- [x] 11c: `Gestão de Riscos` (risk management — modal, shared `riskColors`, dynamic matrix)
- [x] 11d: `Gestão Financeira` (financial management — budget auto-save, ⋯ menu, 5 invoice states)
- [x] 11e: `Gestão de Recursos` (resource management — modal, dropdowns from Admin)

### Session updates (April 2026 — earlier rounds)

- [x] **Initiatives management — Modal redesign:** 6 sections (Identificação / Hierarquia / Datas / Progresso / Responsável-Sponsor collapsible / Notas collapsible), natural labels (`Início Planeado` / `Fim Planeado` — Planned Start / Finish), `DateRangePicker`, cascading parent selector, `% Previsto` (target %) auto-calculated
- [x] **Initiatives management — Novo Plano Wizard:** 2-step modal (Step 1 plano form, Step 2 optional Excel import with preview, hierarchy inferred by row order, parent chain built via `buildN345`)
- [x] **Initiatives management — Live search:** text filter preserves hierarchy (shows ancestors of matches), auto-expand, amber highlight, empty state inline
- [x] **Initiatives management — Activity Dependencies:** collapsible `"Dependências"` section in modal (N4+ only), add / remove / update predecessors with validation (cycle / duplicate / non-leaf / self-dep / dates), 4 types FS / SS / FF / SF + `lag_days`
- [x] **Initiatives management — Orphan planos:** plans without activities now appear as collapsible N2 rows in the tree
- [x] **Resource management — Autocomplete:** person catalog with inline creation, role / unit badges, keyboard navigation, duplicate warning, auto-fill `Perfil` / `Unidade` / `Tipo` (profile / unit / type), link indicator 🔗 `Catálogo` (catalog) / `Não ligado` (not linked)
- [x] **Risk management — Grade badges:** use shared `riskColors` lib, thresholds from `app_config`

### Session updates (April 28-29 — Activities tab refactor + Modal redesign + Dependencies polish)

- [x] **Activities tab:** `% EXEC` column alignment N0-N4, single bulk toggle (`Colapsar` / `Expandir` — collapse / expand), right-aligned toolbar
- [x] **Activities tab:** row selection with amber highlight + double-click to edit + context-aware `Nova Actividade` (new activity — level + parent inferred from selection)
- [x] **Activities tab:** `user-select: none` on rows (no text selection on dbl-click)
- [x] **Modal redesign:** label `"Nome"` → `"Designação"` (name → designation), breadcrumb removed (already in page header), `Hierarquia` conditional (N3 hides section, N4+ hides label only)
- [x] **Modal redesign:** Dates — 4 discrete date inputs with inline label `Início:` / `Fim:` (Start: / Finish:), REAL always visible, BASELINE editable only for admin / program_manager
- [x] **Modal redesign:** Progress — `% Execução` (execution %) numeric input + `% Prevista` (target %) inline single row, no slider
- [x] **Modal redesign:** removed `Responsável` / `Sponsor` section + `RESPONSÁVEL` column from table (data model preserved)
- [x] **Modal redesign:** validation accumulates all errors before save (`Designação` + baseline dates + REAL start if finish filled)
- [x] **Modal redesign:** empty dates in new mode + `"Limpar"` (clear) button per group (handles iOS Safari date picker quirk)
- [x] **Dependencies polish:** predecessor chip in standalone `Actividades` + `PlanoPage` tab (`Link2` icon + count, only for leaves with > 0)
- [x] **Dependencies polish:** gap warning (> 7 days FS) with `AlertTriangle` + tooltip
- [x] **Dependencies polish:** unified-row layout — saved + edit row identical structure (predecessor select / type / lag / actions)
- [x] **Dependencies polish:** styled selects matching modal dropdowns (no native browser styling)
- [x] **Dependencies polish:** Info icon with CSS tooltip in section header (FS / SS / FF / SF explained)
- [x] **Dependencies polish:** column alignment via CSS grid (gap warning slot reserved even when empty)
- [x] **`Visão Executiva` (executive view):** 3 cards aligned (`Estado` / `Execução` / `A Requerer Atenção` — Status / Execution / Requires Attention) — vertical alignment + Card 2 reorder + `delta=0` muted
- [x] **`Visão Executiva`:** snapshot delta bug fix (TIMESTAMPTZ slice to 10 chars before comparison) — deltas now render with sufficient history

### Session updates (April 30 — Design System Phase 1 + Stratgos rename Phase A + Subtle Warm palette)

- [x] **CLAUDE.md Brand Identity:** v1.0 section inserted (palette, type scale, voice, iconography, cobranding)
- [x] **Tokens consolidated:** extracted to `src/styles/tokens.css` (67 tokens, 10 sections)
- [x] **New token families:** spacing scale (4-40px), font-size scale (10-28px), shadow scale (sm / md / lg / xl), status tints, topbar tints, ember-dark hover
- [x] **Stratgos rename Phase A (frontend visible):** Layout footer `"Powered by Stratgos"`, SplashScreen alt + fallback, Admin export filename, TODO.md title (5 occurrences in source files)
- [x] **Subtle Warm Family palette applied** (later superseded by Forge Deep v5 in May 2026)

### Session updates (May 2026 — Waves 4 to 7 + DB fix)

- [x] **Wave 4:** `NovoPlanoModal` extraction — wizard shared by `GI` (initiatives management) and `PlanosCatalog`
- [x] **Wave 4.1:** `NovoPlanoModal` cleanup
- [x] **Wave 4.1.1:** polish
- [x] **Wave 5a:** sunset `GestaoRiscos` (risk management) standalone (route + sidebar + `mode` prop)
- [x] **Wave 5b:** sunset `GestaoPDS` standalone
- [x] **Wave 5c:** sunset `GestaoRecursos` (resource management) standalone
- [x] **Wave 6:** sunset `GestaoIniciativas` + `PlanoPage` rewire + `PlanosCatalog` edit
- [x] **Wave 7 (original, April-May 2026):** `DuplicatePlanoModal` with deep-copy + hybrid time-shift. Note: the name “Wave 7” was later reused for another wave — bundle splitting — which was reverted; see “Session updates May 2026 — Waves 3, 7, 8” below
- [x] **DB fix (migration 029):** `log_change` trigger function corrected to use `auth.uid()` (was `COALESCE(NEW.updated_by, OLD.updated_by)` — failed on planos / eixos)

**Net result:** sidebar `GESTÃO` (management) section with no standalone entries; all plan management lives in `PlanosCatalog` (+ New / Edit / Duplicate) and `PlanoPage` (Edit inline, embedded tabs for activities / PDS / Risks / Resources / Financial).

### Session updates (May 2026 — Branding + Admin Rework)

- [x] **Topbar Dynamic wave (`a7cd288`):** Topbar reads brand identity from `app_config` dynamically
- [x] **Login Brand wave (`7937dc0`):** removed old branded topbar, added centered brand area
- [x] **Admin Foundation + Restructure + Plano Polish wave (`22cfb99`):** drift fixes, F restructure, Plano polish
- [x] **Profile wave (`9040375`):** new `/profile` route with live updates
- [x] **D2 Admin Polish + Pessoas profile_id Linking wave (`c184a8a`):** `viewer` → `stakeholder` (M032), `Pessoas` (people) `profile_id` editable, `SearchableSelect` overflow fix

**Net result:** brand identity end-to-end (topbar, login, splash, footer, favicon) + Admin reorganized following SaaS conventions + Profile page operational + Pessoas linkable to auth users.

### Session updates (May 2026 — Wave C, Wave H, Evolução chain, smoke test bug fixes)

- [x] **Wave C Tier 1 (`0834fb4`):** dynamic filter labels per program in `FilterBar` + `Breadcrumb`
- [x] **Filter Owner / Sponsor scope (`c8d6a93`):** scoped to active programs
- [x] **Dashboard `Pontos de Atenção` height fix (`abe32c0`)**
- [x] **Wave C Tier 2 (`46bd309`):** dynamic labels extended to 7 more surface groups + PT-PT canonical normalization (Owner → `Responsável`, Sponsor → `Patrocinador`)
- [x] **Wave H — Plan-level permissions (`08d642c` + `6de9ebe`):** frontend gates per plan, not just per program. M033 (audit trigger) + M034 (partial unique indices). `UserPermissionsModal` replaces 2D matrix. Save: single delete-all + insert-desired transaction
- [x] **`Evolução` label resolution chain:** 3 hotfixes; final `b509016` filters snapshot `by_n1` by current program
- [x] **Smoke test bug fixes:** #2 Excel import (`d8dc1e5`), #3 sidebar empty sections (`e7b7a35`), #4 Profile sticky after user switch (`e7b7a35`), #1 multi-value Owner / Sponsor (`898d512` + `ca2e255`) — `MultiPersonSelect` component

**Net result:** filter system end-to-end customizable per program + plan-level permissions across all surfaces + `Evolução` (evolution) comparison table accurate per program + 4 smoke test bugs resolved.

### Session updates (May 2026 — Admin User Lifecycle wave)

Complete admin user management cycle via Edge Functions (4 functions deployed manually via Supabase Dashboard due to the macOS 11 limitation).

- [x] **Invite User flow** (`585efda` + `c3d0b76` + `d37aa38`): `invite-user` Edge Function + `SetupPassword` page (`/setup-password`)
- [x] **Delete User flow** (`6274dcf`): `delete-user` Edge Function + `ConfirmModal` reusable component
- [x] **Force Reset Password** (`220cd51`): `force-reset-password` Edge Function + Key icon button
- [x] **`ConfirmModal` migration** (`013bae2`): 7 destructive `window.confirm` → `ConfirmModal`
- [x] **Edit User Modal** (`636c34d`): `update-user-email` Edge Function + `EditUserModal`
- [x] **Structured Edge Function error handling** (`636c34d`): `extractEdgeFunctionError` helper for `FunctionsHttpError` context body
- [x] **Custom email templates in PT-PT** (Supabase Dashboard, no code commit): 4 templates (Invite / Reset / Magic Link / Confirm Signup) with Stratgos branding

**Net result:** admin user lifecycle complete (invite → setup → edit → reset → delete). All privileged operations gated by admin role + service_role. Consistent `ConfirmModal` UX.

### Session updates (May 2026 — Waves 3 + 7 (bundle splitting, reverted) + 8)

This was a multi-day stretch with one significant rollback. Details preserved for context.

- [x] **Wave 3 — 3-zone band threshold model** (`bc174f7`): bug #5 (status divergence Dashboard vs `PlanosCatalog` vs `Actividades`) resolved.
  - Migration 036 (`b303e44` + `9370e5e`): `app_config` schema correction
  - Wave 3b (`da54edf`): rollup refactor for dual thresholds
  - Wave 3c + 3d (`c299091`): all call sites wired
  - Wave 3e (`cd36ad6`): Dashboard TOTAL row uses `rollupStatus`
  - Wave 3f (`3ab1552`): aggregate status pills + dead imports fix
  - Smoke test DB query confirmed consistency across views for critical planos (#18 CRM 87% `"Em atraso"`, #23 Repositório 80% `"Em atraso"`, #25 Parque Robôs 36% `"Em risco"`, etc.)
- [x] **Wave 8 — TypeScript hygiene + CI gate** (`bcb1130`): 27 → 0 TS errors. Build script changed to `tsc --noEmit && vite build` (CI gate active).
  - Adaptations: Fix 7 deleted dead setters in `GestaoFinanceira` (TS 6.x does not exempt `_`-prefix const from `noUnusedLocals`); Fix 2 used `.then(ok, err)` instead of `Promise.resolve` wrapper
  - Pre-flight DB query confirmed only `"Concluído"` masculine in `pds_entries` — Fix 12 safe
- [❌] **Wave 7 — Bundle splitting (REVERTED)**: lazy-load Admin / `PlanosCatalog` / `PlanoPage` + dynamic xlsx in `NovoPlanoModal`. Initial bundle 501 → 220 KB gzip (-56%, better than target). Commits `2fa9ff2` (Wave 7) + `e9722f3` (hotfix `cssCodeSplit: false`), then reverted via `749105a` + `de8b3c9`.
  - **Why reverted:** broke production visual. KPIs cut off, large NOSSA logo, content shifted left.
  - **Root cause:** Tailwind v4 + Vite + `@tailwindcss/vite` v4.2.2 serializes `@layer` blocks in wrong order in the production build output. `@layer base` (containing the universal reset `*{margin:0;padding:0}`) appears after `@layer components`. Per CSS spec, the first occurrence of a layer name fixes its priority — so `base` wins over `components`. The reset zeros out `.main-content { margin-left: var(--sidebar-w-col) }`.
  - **Workarounds attempted (all failed):** explicit `@layer theme, base, components, utilities;` declaration (minifier removes it), empty `@layer X {}` blocks (minifier removes them), `cssCodeSplit: false` to merge into one file (still wrong order).
  - **Decision:** revert. Wave 7 in standby until structural fix. Possible future approaches: move Tailwind reset out of `@layer base` in source; post-build script to inject layer order; `!important` on critical structural properties; downgrade to Tailwind v3; wait for upstream fix.
  - **Lesson learned:** `npm run dev` shows correct visuals; only `npm run build && npm run preview` exposes the issue. **Smoke test convention added** to the development workflow.
- [x] **Wave 5 (Multiselect removal) was prepared by Claude Code on top of Wave 7 but rebased out** when Wave 7 was reverted. `_Dev` was hard-reset to `1650868` (Wave 8 baseline). To be redone from clean baseline in a future session.
- [x] **Multi-tab Supabase auth lock conflict** discovered during the Wave 7 debug session. Opening Stratgos in multiple browsers / tabs simultaneously with the same user causes “Lock stolen by another request” cascading failures. Workaround: close all tabs. Future fix: configure Supabase JS client `autoRefreshToken` / `multiTab` options.

**Net result in production:** Wave 8 (TS hygiene + CI gate) + Wave 3 (3-zone band threshold model) + everything before. Wave 7 in standby (Tailwind v4 layer ordering bug to resolve first). HEAD on `main` = `de8b3c9` (Wave 7 + hotfix reverted).

### Session updates (May 2026 — Wave 2d pagination fix)

- [x] **Wave 2d pagination fix** (`00f605b`): Supabase REST default 1000-row limit was truncating `activities` queries (total in DB = 1310 rows, but only first 1000 returned). Level=4 leaves alone numbered 328+, and the truncation caused planos with high `sort_order` (e.g. recently created plano #18 CRM with 24 activities) to show only a fraction of their leaves in Dashboard / `PlanosCatalog` / `Actividades`, with cascading status divergence as a side effect.
- [x] **Fix:** added explicit pagination in `useActivities` hook and direct query in `PlanosCatalog`. Confirmed via response header `Content-Range: 0-999/*` and SQL count.

**Net result:** all leaves correctly loaded across all views regardless of total dataset size; bug #5 (status divergence) partially resolved at the data layer (Wave 3 completed the resolution at the rollup layer).

### Session updates (May 2026 — Quick Polish bundle)

- [x] **Tokens v5 fix:** `--bg` / `--bg2` / `--bg3` aliases re-mapped to Forge Deep v5 (`--stratgos-bg` / `--stratgos-surface` / `--stratgos-surface-2`) — previously still pointed to legacy v4 values
- [x] **SplashScreen unification:** `ProtectedRoute` now shows `SplashScreen` during auth loading instead of a blank screen (App.tsx imports + uses at line 23 + 108)
- [x] **NotFound page:** created `src/pages/NotFound/` (`.tsx` + `.css`) with `"Voltar"` (back) and `"Ir para Dashboard"` (go to dashboard) buttons; catch-all route `path="*"` added in App.tsx
- [x] **`UserPermissionsForm` `window.confirm` removal:** migrated to `ConfirmModal` (last remaining `window.confirm` in the form)

**Net result:** loading visual is consistent; invalid URLs render a styled 404 instead of breaking; all destructive confirmations now go through `ConfirmModal`.

### Session updates (May 2026 — Tooltips Wave)

Glossary-driven contextual tooltips across the app. Two-file new component + 12-file integration + PDS-related rename pass.

- [x] **`TermTooltip` component** (`src/components/TermTooltip/`): 2 files created (`.tsx` + `.css`). 500ms delay, dark tooltip with definition + `"Ver glossário →"` (see glossary) deep-link, auto placement, hover-bridge (cursor can enter the tooltip without dismissing), graceful degradation for unknown ids.
- [x] **`glossary.ts` enriched:** all 62 terms now have `id` slug fields. New helpers: `findGlossaryTerm(id)`, `findGlossarySection(id)`, `getActivityStateTermId(state)`, `getPdsStateTermId(state)`.
- [x] **`KpiCard` + `SmartKpi` `tooltipTerm` prop** (optional) added; all existing call sites without it remain unchanged.
- [x] **30 `tooltipTerm` usages** across pages: Dashboard, `Actividades`, `Evolução`, `GestaoFinanceira`, `BudgetPage`, `PontoSituacao`, `VisaoExecutiva`, Gantt, `UserPermissionsForm`.
- [x] **PDS renames (Task 1a-1d):**
  - 1a: `"Gestão PDS"` → `"Gestão de Pontos de Situação"`
  - 1b: `"Pontos de Atenção PDS"` → `"Pontos de Atenção"`
  - 1c: Glossary Section 3 title now `"3. Estados de Ponto de Situação"`
  - 1d: Standalone `"PDS"` term removed from Section 10 (Documents) — now has 4 terms instead of 5
- [x] **Polish iteration:** hover bridge added (cursor entering tooltip does not dismiss it); tooltips removed from status pills in `Actividades` and Gantt (kept only on KPI cards and key indicators — status pills are self-explanatory via color + label)

**Net result:** contextual education of users without leaving the page; glossary-app integration is bi-directional (page references deep-link from tooltip; glossary itself is navigable per-section).

### Session updates (May 2026 — Wave 6d: CLAUDE.md + TODO.md consolidation)

This wave was a documentation pass, no code touched.

- [x] **`CLAUDE.md` v2** — restructured as “living technical manual”: snapshot of current state, no narrative history. All gaps with `TODO.md` reconciled (Edge Functions, `BrandingContext` / `ProfileContext`, 5 roles, Forge Deep v5 palette, Wave H plan-level permissions, `MultiPersonSelect`, `ConfirmModal`, etc.). New “Known Issues & Gotchas” section consolidating Wave 7 Tailwind v4 bug, multi-tab Supabase lock, `FunctionsHttpError`, macOS 11 limitations, email rate limits.
- [x] **`CLAUDE.md` v2 rewritten in English** with PT-PT product terms preserved + inline English translations on first occurrence per section. UI strings cited literally between quotes stay in PT-PT.
- [x] **Tagline corrected:** `Strategy made visible` (was incorrectly stated as `Intelligence driving Strategy` in previous CLAUDE.md).
- [x] **Rollup section corrected to the actual model:** 3-zone band → 4-state status. Each `ThresholdBand` is `{ low, high }` defining the width of the `"Em risco"` middle zone. Defaults: aggregates `{ low: 15, high: 25 }`, leaves `{ low: 5, high: 10 }`. Previously documented as 3-state with single integer thresholds, which was wrong.
- [x] **`TODO.md` v2** — full English rewrite (this current rewrite). Preserves all chronological session entries, adds preamble “How to use this document” defining the changelog + roadmap role and the relationship with `CLAUDE.md`. Waves 3 / 7 (reverted) / 8 documented in chronological detail. Wave 6d itself recorded here. Pre-May 2026 sessions retain their original PT-PT prose by design (passé reconstruction is not worth the cost).
- [x] **Golden rule formalized:** when something changes, update `CLAUDE.md` (state) AND add chronological note in `TODO.md` (history). Documented in both files’ preambles.
- [x] **Smoke test convention formalized:** for build / perf waves, `npm run preview` is mandatory before push. `npm run dev` is NOT a substitute (Tailwind v4 + Vite production-build issues don’t manifest in dev mode).
- [x] **Mac repo synced:** `CLAUDE.md` v2 committed on `dev` (`71f0651`) and merged to `main`.
- [x] **TODO.md cross-check pass (May 2026):** during Wave 6d review, identified and added missing entries — Wave 2d pagination fix (1000-row limit detail), Quick Polish bundle (tokens v5, SplashScreen, NotFound, `UserPermissionsForm` `window.confirm`), Tooltips Wave (`TermTooltip` + glossary integration + PDS renames). Marked `/glossary` standalone page and 404 page as done. Added Phase 13.12 Owner Update Form with full design and decision capture. Added `TermTooltip` and `glossary.ts` documentation to `CLAUDE.md`.
- [ ] **`_Dev` repo sync:** pending. Will be bundled with the next Claude Code wave to avoid burning a dedicated interaction.

**Net result:** documentation aligned with current state; Known Issues centralized; convention layer formalized for future sessions; language standard set to English-with-PT-PT-product-terms going forward.


### Session updates (May 25 2026 — Wave 5 + Wave 4 + Wave 6 Path A + bug fixes + visual polish)

Multi-wave session resolving several queued items. 6 commits to production. Three major waves landed: Wave 5 (multiselect removal redo), Wave 4 (hierarchical sort), Wave 6 Path A (band threshold CRUD migration). Plus bug fixes and a visual polish iteration partially completed.

**Net result:** 6 commits in production (`36006dd`, `b64f472`, `7fb09b4`, `2b7bd60`, `84a17f2`, `020ef14`). Wave 4 + Wave 5 + Wave 6 Path A complete. One bug fix landed (Actividades+Gantt sort). Visual polish backlogged.

### Session updates (May 26 2026 — Phase 13.12 prerequisites: owner/sponsor refactor + Resend SMTP + 3 quick wins)

Pivotal session: completed the full owner/sponsor data model refactor (3 commits), set up Resend custom SMTP with `stratgos.com` domain authentication, and cleared 3 backlog items as quick wins. Bloco 1 — "habilitar a persona Owner externa" — is now 75% complete; only the Owner Update Form MVP (Sub-fase 1.4) remains. Production HEAD: `9747b5d`.

#### Owner/Sponsor refactor (3 commits)

**Goal:** transition `planos.owner` and `planos.sponsor` from free-text strings to FK references against `people.id`, so the Owner Update Form can resolve owner emails for email-driven update flows.

**Decisions recap (from prior planning):**

- Owner data are dummy → no production data to preserve → big-bang B-adaptado migration preferred over hybrid
- 3 columns per role (`_person_ids[]` + `_primary_id` + `_label_override`) applied symmetrically to owner AND sponsor for future flexibility, even though only owner is involved in the Owner Update Form MVP
- Pattern matches Linear/Stripe/Notion: structured FKs replace ambiguous strings
- Refactor split into 3 commits (migration + write paths + read paths) to keep each step testable and reversible

**Commit 1 of 3 — Migration 039 + types + helper (`7f37c5c`):**

- Migration `039_owner_sponsor_person_refs.sql`: adds 6 columns to `planos` (3 for owner, 3 for sponsor); auto-populates from existing strings via case-insensitive `JOIN people.name`; uses `regexp_split_to_table` with `|` or `,` as separators; `WITH ORDINALITY` preserves order; unmatched fragments produce empty arrays
- `src/types/index.ts`: `Plano` interface gains 6 new fields; legacy `owner` / `sponsor` strings marked `@deprecated`
- New file `src/lib/owners.ts`: 4 helper exports — `resolveOwnerNames`, `resolveSponsorNames`, `resolveOwnerPrimaryEmail`, `formatPeopleList`
- Migration 039 applied via Supabase Dashboard. Auto-population stats: 13/24 owners populated (54%), 12/24 sponsors (50%). The 10 unmatched owners are all initials (`A.L.`, `H.Q.`, `MPC`) or org units (`DCH`, `GGE`) — expected and acceptable

**Commit 2 of 3 — Write paths + dual-write (`8b89ec2`):**

- `src/lib/owners.ts`: 2 new transitional helpers — `buildLegacyOwnerString` / `buildLegacySponsorString` (removed in commit 3)
- `NovoPlanoModal.tsx`: refactored both save handlers (`handleSavePlanoEdit` and `handleSavePlanoWithActivities`) to dual-write — both FK fields AND legacy strings kept in sync via the new helpers. `MultiPersonSelect` continues to use `p.name` as `value` to preserve chip display UX; UUIDs derived at save time via `peopleByName.get(n)?.id`. Adds `peopleMap` + `peopleByName` memos. Adds `ownerLabelOverride` / `sponsorLabelOverride` state with a text input ("Ou nome de entidade (raro)") below each MultiPersonSelect
- `DuplicatePlanoModal.tsx`: copies FK fields + rebuilds legacy strings from FKs to ensure consistency
- `MultiPersonSelect.tsx`: untouched (already generic — accepts any `value: string[]` from options)
- Org units (`DCH`, `GGE`) appear as dropdown options with `subtitle: 'Unidade'`. At save time they don't match `peopleByName` and were silently dropped — captured in backlog, fixed later in this session as Quick win 3
- Smoke-tested all 5 validation points (create, edit, label_override, duplicate, regression)

**Commit 3 of 3 — Read paths + drop legacy (`3f0d274`):**

- Migration `040_drop_planos_owner_sponsor_strings.sql`: drops `planos.owner` and `planos.sponsor` (legacy strings). Applied AFTER smoke test of frontend
- `src/types/index.ts`: `@deprecated owner` and `@deprecated sponsor` fields removed from `Plano` interface
- `src/lib/owners.ts`: transitional helpers (`buildLegacyOwnerString`, `buildLegacySponsorString`) removed — no callers after commit 3. 4 final exports remain
- `FilterContext.tsx`: filter state changed from name strings to UUIDs. `ownerOptions` and `sponsorOptions` derived from `owner_person_ids[]` via `peopleMap` lookup; `personIdToName` map exported for downstream use. Session storage version bumped to v2 to invalidate old filter state. Org units no longer filterable (decision A: filters only by people)
- `FilterBar.tsx`: dropdowns adapted to UUID values; name↔UUID translation mirrors the program filter pattern
- `Breadcrumb.tsx`: filter chips resolve UUIDs to names via `personIdToName` for display
- `NovoPlanoModal.tsx`: dual-write removed; init no longer falls back to `planoToEdit.owner` (field doesn't exist anymore)
- `DuplicatePlanoModal.tsx`: dual-write removed
- Read paths refactored to use `resolveOwnerNames` / `resolveSponsorNames`: `PlanoPage.tsx`, `PlanosCatalog.tsx`. `Recursos.tsx` and `ExecucaoFinanceira.tsx` adapted to UUID-based scope matching. `Admin.tsx`: select updated to FK fields; tooltip uses `owner_label_override`
- **Breaking change documented:** URL filters that previously had name strings are no longer compatible. Bookmarked URLs lose the filter silently. Acceptable scope for dummy-data phase
- Smoke-tested all 11 validation points BEFORE applying migration 040. Migration 040 applied via Supabase Dashboard. Post-migration smoke OK

**Final architecture:**

- `planos.owner_person_ids uuid[] NOT NULL DEFAULT '{}'`
- `planos.owner_primary_id uuid REFERENCES people(id) ON DELETE SET NULL`
- `planos.owner_label_override text`
- Same triplet for sponsor
- No more `planos.owner` or `planos.sponsor` columns
- Filter identity in URL = UUIDs (robust, less readable URL)
- Multi-owner natively supported via array
- Owner Update Form will use `owner_primary_id` to identify which person receives email

#### Custom SMTP setup — Resend (~30 min)

**Goal:** resolve Supabase free-tier rate limit (4 emails/hour) and use `stratgos.com` domain for outgoing emails. Pre-requisite for Owner Update Form.

**Steps executed:**

1. Created Resend account, chose Europe region (closer to PT/Angola servers)
2. Added domain `stratgos.com` via Resend's **native Cloudflare integration** — Resend authorized one-time access to Cloudflare DNS and added 3 records automatically:
   - `MX send.stratgos.com → feedback-smtp.eu-west-1.amazonses.com` (bounces/feedback)
   - `TXT resend._domainkey.stratgos.com → ...` (DKIM)
   - `TXT send.stratgos.com → v=spf1 include:amazonses.com ~all` (SPF)
   - All `DNS only` (not proxied), TTL 1hr
3. DNS records propagated within minutes (Cloudflare native), all 3 verified ✓
4. Connected Resend to Supabase via Resend's **native Supabase integration**:
   - Resend dashboard → Integrations → Supabase → Connect
   - OAuth flow with Supabase account
   - Selected project (`wirokqtgrvlxwvypmbej`)
   - Confirmed sender email `noreply@stratgos.com` and sender name `Stratgos`
   - Integration creates Resend API key, auto-fills Supabase SMTP settings (no manual copy-paste)
5. Validated end-to-end: triggered password reset email from production app → email arrived in inbox (not spam) within 30s; Resend logs showed **Delivered**

**Result:** Supabase now sends all auth emails (and future application emails via Edge Functions) through Resend on `stratgos.com` domain. Free tier (3000 emails/month) more than sufficient for MVP + early customer phase.

**Why this matters:** Owner Update Form Edge Functions will reuse the same Resend stack — no additional integration work.

#### Quick wins (3 commits)

**Quick win 1 — `useActivities.ts` dead code (`7435051`):**

- 4 references to `owner` / `sponsor` removed from `src/hooks/useActivities.ts` (interface, destructure, two query branches, useEffect dep)
- These queried `activities.owner` / `activities.sponsor` columns dropped in Wave 8d months ago — silent failures because no caller passed those params (verified 7 call sites)
- Net: −6 lines, 0 behavior change

**Quick win 2 — Filter popup scroll UX (`21e1314`):**

- In `SecondaryFiltersMenu` (inside `Breadcrumb`), the entire popup scrolled including Estado/Owner/Sponsor group titles, making long lists confusing
- New CSS: each group's options list (`.bfp-group-options`) has its own `max-height: 180px` + `overflow-y: auto`. Group titles (`.bfp-group-title`) are `position: sticky; top: 0` within their group
- `Breadcrumb.tsx`: each group's options wrapped in `<div className="bfp-group-options">` (consistent across all 3 groups)
- No JS logic change

**Quick win 3 — Owner/Sponsor unit semantics fix (`9747b5d`):**

- When user selected an org unit (`DCH`, `GGE`) from `MultiPersonSelect` dropdown, the fragment didn't match in `peopleByName` and was silently dropped during save
- Fix: in both `handleSavePlanoEdit` and `handleSavePlanoWithActivities`, non-matched fragments are captured (`ownerUnmatched`, `sponsorUnmatched` arrays) and concatenated into `owner_label_override` / `sponsor_label_override` (joined by ` | `), preserving user intent
- User-typed label override input still takes precedence — auto-captured fragments appended after
- Backward compatible: matched people behave identically
- DB validation: edited plano `#38 RFP GPS` with Abel Lelo + GGE → `owner_person_ids = [uuid-Abel]`, `owner_label_override = 'GGE'` ✓

#### Commits landed this session

| # | SHA (Mac) | Title |
|---|---|---|
| 1 | `7f37c5c` | feat(planos): owner/sponsor as FK to people (commit 1/3) |
| 2 | `8b89ec2` | refactor(planos): write paths use FK fields for owner/sponsor (commit 2/3) |
| 3 | `3f0d274` | refactor(planos): read paths use FK fields + drop legacy strings (commit 3/3) |
| 4 | `7435051` | chore(activities): remove dead owner/sponsor filter params |
| 5 | `21e1314` | fix(breadcrumb): sticky group titles + per-group scroll in filters popup |
| 6 | `9747b5d` | fix(plano): preserve org-unit selections in owner_label_override |

**Migrations applied:** 039 (add FK columns + auto-populate), 040 (drop legacy strings).

**Files added this session:** `src/lib/owners.ts`, `supabase/migrations/039_owner_sponsor_person_refs.sql`, `supabase/migrations/040_drop_planos_owner_sponsor_strings.sql`.

#### Known issues registered this session

- **`@supabase/gotrue-js` auth-token lock warnings** in dev preview console — caused by React Strict Mode double-mount; non-blocking, only in dev/preview, not in production builds. No fix planned.

#### Sub-fase 1.4 — Owner Update Form MVP — sequencing plan

Total estimated ~28h split across **3 sessions**:

**Componente A — Backbone técnico (~10h)**
- A1: DB schema `update_tokens` + RLS (~1h)
- A2: Edge Function `send-update-request` (gera token + envia email via Resend) (~3h)
- A3: Edge Function `submit-owner-update` (valida token + cria draft) (~3h)
- A4: Email template PT-PT com brand Stratgos (~2h)
- A5: Rate limit logic (1/(owner,plano)/7d configurable) (~1h)

**Componente B — Formulário público (~8h)**
- B1: Página `/update/:token` (token validation, error states) (~1h)
- B2: Layout responsive mobile-first, sem app shell (~2h)
- B3: Form fields: % execução por activity, datas reais por activity (~2h)
- B4: Form fields: 4 textareas PDS com placeholders úteis (~2h)
- B5: Submit flow + thank-you page (~1h)

**Componente C — UI PMO (~10h)**
- C1: Botão "Pedir actualização" no PlanoPage (~1h)
- C2: Modal "Quem queres convidar" (multi-owner picker) (~2h)
- C3: Confirmação + envio + toast (~1h)
- C4: Lista de "Updates pendentes" (drafts) — novo tab/secção (~3h)
- C5: Revisão de draft: side-by-side current vs proposed (~2h)
- C6: Aceitar/Rejeitar com audit log (~1h)

#### Wave 5 — Multiselect removal redo (commit `36006dd`)

Originally prepared by Claude Code on top of Wave 7 (bundle splitting), then rebased out when Wave 7 was reverted. Redone from clean baseline.

- [x] **`ExecucaoFinanceira` + `Recursos` pages:** removed local plano `<MultiSelect>` components. Both pages now wire to the global breadcrumb’s `n2Values[0]` (single plano filter).
- [x] **New filter context fields:** `breadcrumbPlanoId`, `ownerPlanoIds`, `sponsorPlanoIds` with AND logic for compound filtering.
- [x] **Smoke test result:** discovered scroll-bar UX issue in `+ Filtros` popup (CSS `max-height: 400px` hides Owner/Sponsor sections below Estado on macOS with auto-hidden scrollbars). **Not a regression** — pre-existing UX issue. Backlogged.

#### Wave 4 — Hierarchical natural sort (commit `b64f472`)

Wave 4 split into 2 sub-waves: 4a (DB migration) + 4b (frontend).

**Sub-wave 4a — Migration 037:**

- [x] **Migration 037 applied** via Supabase Dashboard SQL Editor: `ROW_NUMBER() PARTITION BY parent ORDER BY numeric code first, then text code, then created_at`.
- [x] **Idempotent:** safe to re-run; programs, eixos, planos, and activities all renumbered with per-parent canonical `sort_order` starting from 1.
- [x] **Pre-flight findings:** 4 programs all had `sort_order=0`; 26 eixos all `0`; 10/25 planos had `0`; zero orphan rows.
- [x] **Discovery:** duplicate plano `#19 ERP` (code `19` vs `#19`) detected in eixo `b224a876` — user deferred investigation.

**Sub-wave 4b — Frontend:**

- [x] **New library `src/lib/sort.ts`:** exports `compareCodes(a, b)`, `comparePlanos(a, b)`, `compareEixos(a, b)` using `Intl.Collator('pt-PT', { numeric: true })` for natural ordering.
- [x] **`FilterBar.tsx`:** maps n1/n2 text values to eixo/plano objects, then sorts by `sort_order` (with `Infinity` fallback for missing data).
- [x] **`PlanosCatalog.tsx`:** default sort uses `comparePlanos` hierarchically.
- [x] **`Admin.tsx`:** new programs/eixos use `max-within-parent + 1` for sort_order (no more hardcoded `0`).
- [x] **`NovoPlanoModal` + `DuplicatePlanoModal`:** already correct, no changes needed.
- [x] **Migration 037 versioned** at `supabase/migrations/037_sort_order_per_parent.sql`.

#### Wave 6 Path A — Threshold band CRUD migration (commits `7fb09b4` + `2b7bd60`)

Two-commit wave. Closes a fundamental gap discovered in audit: Wave 3 (May 2026) migrated the **read layer** to `ThresholdBand {low, high}` model but never migrated the **write layer**. Forms still wrote to deprecated single-value fields, which the read layer ignored.

**Audit findings (pre-flight):**

- 40+ hits of deprecated fields across `Admin.tsx` (22), `NovoPlanoModal.tsx` (14), `DuplicatePlanoModal.tsx` (2), `Layout.tsx` (1), `types/index.ts` (4).
- 3 critical mismatches:
  - **M1:** Admin Program threshold UI edits had **zero runtime effect** (writes to dead fields).
  - **M2:** Plano-level overrides completely dead (25/25 planos had NULL on new band fields).
  - **M3:** App was computing correct statuses **by accident** (defaults coincided).

**Decisions:**

- Path A directly (no Path C transitional fallback).
- UI: 2 separate inputs per pair (Low green-amber border, High amber-red border), no spinner arrows.
- Client-side validation: `low ≥ 0`, `≤ 100`, `high ≥ low` — applied to all 3 forms.
- 2 commits: Commit 1 = frontend, Commit 2 = DB migration 038.

**Commit 1 — Frontend (`7fb09b4`):**

Multiple polish iterations consolidated:

- [x] **`types/index.ts`:** removed `@deprecated` fields from `Plano` and `Program` interfaces.
- [x] **`Admin.tsx`:** rewrote `Programas e Eixos` section from accordion → flat hierarchical table → modal-based editor (final pattern).
- [x] **New components:** `AdminProgramModal.tsx`, `AdminEixoModal.tsx` (modal-based create/edit, max-width 560px, ESC/backdrop/Cancel all close).
- [x] **`NovoPlanoModal.tsx`:** added `defaultEixoId` prop for invocation from Admin tree + `contextLabel` prop for “Novo Plano · em <programa> › <eixo>” titles.
- [x] **`DuplicatePlanoModal.tsx`:** band fields wired.
- [x] **`Layout.tsx`:** new band config keys loaded at startup.
- [x] **CSS:** `index.css` and `Admin.css` updated with `.threshold-pair` styles + spinner removal.
- [x] **Tab `"Plano"` renamed to `"Definições"`** in Admin sidebar (PT-PT software convention; “Plano” misled because it suggested config for a specific plano entity).
- [x] **Inline `Limiares` column** in Admin tree: format `Agregados X–Ypp · Actividades W–Zpp` (single line, hierarchy: Agregados first).
- [x] **All 3 threshold pair forms** (Admin Program modal, NovoPlanoModal, Definições tab) reordered to Agregados-first for consistency.
- [x] **Tooltip ⓘ** on each plano row with Responsável + Patrocinador (reuses `gi-tooltip-trigger` pattern).
- [x] **Empty states:** `Sem eixos` / `Sem planos` in cinzento italic when a programa/eixo expands with no children.
- [x] **Sort:** all 3 levels (programs, eixos, planos) ordered by `sort_order ASC` (canonical from Wave 4).

**Commit 2 — Migration 038 (`2b7bd60`):**

- [x] **`supabase/migrations/038_drop_deprecated_thresholds.sql`** created and applied via Supabase Dashboard SQL Editor.
- [x] **DB changes:**
  - Dropped `programs.threshold_aggregates` and `programs.threshold_leaves` (both NOT NULL, populated; values lost but already duplicated in `_low`/`_high`).
  - Dropped `planos.threshold_aggregates` and `planos.threshold_leaves` (both NULL on all 25 planos).
  - Deleted 3 legacy `app_config` keys: `status_delay_threshold`, `status_delay_threshold_aggregates`, `status_delay_threshold_leaves`.
- [x] **Verification:** post-migration confirmed 8 threshold columns remain (4 per table, all `_low/_high`), 4 `app_config` keys remain (all `_low/_high`).
- [x] **Pre-flight `grep` confirmed:** zero references to deprecated fields/keys in `src/`.

**Net result:** threshold model now fully band-based across all layers (read, write, persist, UI, DB). Wave 6 Path A complete.

#### Bug fix — Actividades + Gantt hierarchical sort (commit `84a17f2`)

Discovered during Wave 6 commit 2 smoke test: `Actividades` and `Gantt` pages showed eixos and planos in inconsistent / random order. Root cause: `useActivities.ts` queries `ORDER BY sort_order ASC` but `sort_order` is per-parent (per `(plano_id, level)`), so global ordering returns Postgres heap order for collisions.

Wave 4 was applied to `FilterBar`, `PlanosCatalog`, and `Admin` — but missed these two pages.

- [x] **Client-side hierarchical sort** added in `Actividades.tsx` and `Gantt.tsx`.
- [x] **Strategy:** maps from `usePrograms`, `useEixos`, `usePlanos` to resolve hierarchy. Sort order: `program_id` → `eixo` (matched by `program_id:n1` text) → `plano_id` → `level` → `sort_order`.
- [x] **`useActivities` hook unchanged** — kept simple; each consumer decides its own ordering.
- [x] **Verified:** `Plano Estratégico → Eixo 6` now shows planos in numeric ascending order (`#18, #20, #23, #24, #25, #26, #27, #28`).

#### Admin tree visual polish — partial (commit `020ef14`)

Attempted to align Admin Programas/Eixos/Planos table colors with the Actividades pattern. Two iterations applied, both partial.

- [x] **Iteration 1 (commit `f3e5710` in `_Dev`):** applied `parchment-deep` / `parchment` / `transparent` backgrounds per level → user feedback: too heavy.
- [x] **Iteration 2 (commit `7919271` in `_Dev`):** reverted to neutral bg, consolidated `border-bottom` to a single high-specificity rule on `<td>`. Hierarchy expressed only via font weight + color.
- [x] **Left-border highlight removed** — chevron `▾`/`▸` indicates expand state instead.

**Persistent visual artifacts after 5 fix attempts:**

- Double border on some rows.
- “+ Novo X” rows have invisible bottom border on some configurations.
- Row heights vary between data rows and “+ Novo X” rows.

**Read-only audit completed** (commit not applied):

- JSX is heterogeneous: data rows have 3 separate `<td>` cells, “+ Novo Eixo”/”+ Novo Plano” rows use 1 `<td colSpan={3}>`, “+ Novo Programa” lives **outside** the `<table>` in a `<div className="adm-panel-footer">`.
- CSS itself is statically correct (`border-collapse: collapse`, no conflicting rules).
- Root cause **hypothesis** (not confirmed in browser): (A) Tailwind v4 `@layer` ordering bug in production builds suppressing border-width — same bug that blocked Wave 7; (B) Card wrapper interaction with table edge borders.

**Decision:** backlog the visual polish — not worth further iterations vs. value delivered. Functionality is fine. Final commit `020ef14` represents partial state with `selected` class still present in JSX (now visually a no-op).

#### Workflow improvements / lessons

- [x] **Smoke test convention reinforced:** `npm run preview` mandatory for build / perf waves (already in convention layer).
- [x] **Pre-flight queries pattern paid off** for Wave 4 (sort_order audit) and Wave 6 Path A (deprecated field detection in `src/`).
- [x] **Read-only audit pattern introduced:** when iterative fixes fail multiple times, ask Claude Code to inspect and report (no commits) before any more code changes. Saves further iteration cycles.

**Net result:** 6 commits in production (`36006dd`, `b64f472`, `7fb09b4`, `2b7bd60`, `84a17f2`, `020ef14`). Wave 4 + Wave 5 + Wave 6 Path A complete. One bug fix landed (Actividades+Gantt sort). Visual polish backlogged.

### Pending — registered during this session

- [ ] **Admin tree visual polish (final pass):** investigate Tailwind v4 layer ordering interaction with table borders, OR uniformize “+ Novo Programa” into the `<table>` with colspan (currently lives in `adm-panel-footer` div outside). Possibly bundled with the Tailwind v4 root-cause investigation that’s blocking Wave 7.
- [ ] **`+ Filtros` popup scroll UX:** CSS `max-height: 400px` hides Owner/Sponsor sections below Estado on macOS with auto-hidden scrollbars. Add visible scrollbar styling or sticky section headers.

### Pending in Phase 11

- [ ] Drag & drop reorder in `PlanosCatalog` / activities
- [ ] Inline editing in `Gestão de Riscos` table (no side panel)
- [ ] `Gestão Financeira`: visual consistency of toggles

-----

## Phase 12 — Admin ✅

- [x] Section 1: `Geral` (general — title, subtitle, logo, cutoff, dual thresholds, health rules, PDS hide-completed-days)
- [x] Section 2: `Programas e Eixos` (programs and axes — 3-panel drill-down CRUD)
- [x] Section 3: `Utilizadores e Permissões` (users and permissions — user CRUD + 12-page permission matrix)
- [x] Section 4: `Recursos` (resources — profiles, org units, people catalog with dropdowns)
- [x] Section 5: `Financeiro` (financial — 4 tabs: `Moedas` / `Categorias` / `Anos` / `Alertas de Facturas`)
- [x] Section 6: `Risco` (risk — matrix size 3-6 × 6, 5-level thresholds, live preview, risk states)
- [x] Section 7: `Histórico` (history — snapshots + change log with filters)
- [x] Section 8: `Dados e Importação` (data and import — Excel upload / preview, full export, filter labels)

### Session updates (April 2026 — continuation)

- [x] Matrix dropdown: `edit` option hidden for viewers
- [x] Role change `editor → viewer`: modal with edit-count confirmation + downgrade
- [x] Fix key mismatch `execucao-financeira` → `exec-financeira` (Migration 020)

### Session updates (May 2026 — Restructure + Polish)

- [x] **Foundation cleanup** (`22cfb99`): 7 emojis → Lucide, hardcoded hex → tokens, `borderRadius: 3` → `var(--r)`
- [x] **Restructure:** `Plano` tab created; `Geral` simplified; `Alertas` tab removed; new SaaS-convention order
- [x] **Plano auto-save** on blur with inline `"Guardado"` (saved) indicator (per-field)
- [x] **Severidade dropdown** in `Alertas` styled with `.styled-select-sm`
- [x] **`Histórico` fix** (`22cfb99` + `c184a8a`): `change_log` column references corrected; `Registo` now displays 29,796+ rows with expandable JSON diff
- [x] **D2 polish** (`c184a8a`): `viewer` → `stakeholder` (M032); admin-row buttons disabled with tooltip; `Pessoas` `profile_id` editable
- [x] **`SearchableSelect` overflow fix** (`c184a8a`): position fixed via `getBoundingClientRect`

### Session updates (May 2026 — Wave H Permissions Rework)

- [x] **`UserPermissionsModal`** (`08d642c`): per-user modal replaces 2D matrix
- [x] **Save logic refactor** (`13a6131` + `3fa9c8b`): single batch save via delete-all + insert-desired transaction; fixes ‘No API key’ error
- [x] **Migration 033** (`c2bed0d`): `log_change` trigger attached to `user_permissions`
- [x] **Migration 034** (`148f098`): partial unique indices allow program-level + plan-level co-existence

-----

## Phase RLS — Permissions Hardening (April 2026) ✅

### Phase 1 — DB helper

- [x] `user_has_program_access(program_id)` function with `SECURITY DEFINER`

### Phase 2 — SELECT scoped

- [x] RLS policies on 8 tables filter rows by `user_has_program_access`
- [x] Dropped 4 duplicate “authenticated can read” legacy policies

### Phase 3 — Write scoped by program

- [x] 21 INSERT / UPDATE / DELETE policies using `user_has_program_access`

### Phase 4a — Key mismatch fix

- [x] Migration 020: rename `execucao-financeira` → `exec-financeira` in `user_permissions`
- [x] `Admin.tsx` MATRIX_PAGES aligned

### Phase 4 — Writes respect access_level

- [x] New function `user_can_edit_program_page(program_id, page)`
- [x] Migration 021: 21 write policies now check page + `access_level='edit'`

### Phase 4b — Frontend read-only mode

- [x] New hook `useCanEditCurrent(page)`
- [x] Breadcrumb shows `"· apenas leitura"` (`· read-only`) badge on `gestao-*` when user can’t edit
- [x] All 5 gestão pages hide edit / create / delete buttons + disable inputs when read-only

### Phase 4c — Sidebar filtered (verified)

- [x] Sidebar uses `hasAccess(page)` — menus without access hidden

### Phase 5 — Page-aware program filtering

- [x] New hook `useAccessiblePrograms(page?)`
- [x] Breadcrumb filters programs by current page permission
- [x] 8 Pattern B pages use the filtered hook
- [x] `Evolução` migrated from independent state to `FilterContext`
- [x] Auto-reset of invalid `programIds`
- [x] Empty state `"Sem programas disponíveis nesta página"` (`No programs available on this page`)
- [x] Eixo / Plano options bounded by `accessibleProgramIds` even when `Programa=Todos`

### Frontend alignment

- [x] `usePermissions` deny-by-default: zero permissions → return false
- [x] `hasAccess` / `canEdit` fallthrough bug fix: return false when `programId` has no match
- [x] Viewer gate in `canEdit`: `role='viewer'` always returns false (later: `stakeholder`)

### Breadcrumb — Parallel filters (April 2026)

- [x] 3 dropdowns always visible (`Programa · Eixo · Plano`)
- [x] Cascade on parent select + auto-fill on child select
- [x] Cross-navigation via child recalculates parents
- [x] `sessionStorage` persistence (resets on new tab)
- [x] `trySetProgram` guard with toast for inaccessible programs

### Supabase auth fix

- [x] `handle_new_user()` missing `SET search_path = public` → user creation was broken in Dashboard

-----

## Phase 13 — Improvements & Polish

### ✅ Completed (April 2026)

#### Stratgos v1.0 visual identity (initial — superseded by Phase 13.5)

- [x] Nocturne palette (initial palette) — superseded by Subtle Warm Family → then by Forge Deep v5
- [x] `Parchment` background, `Cream` cards, KPI surfaces — values updated multiple times (April 30, then Forge Deep v5 in May 2026)
- [x] Semantic pills (brand ≠ semantic): `Ontrack` / `Late` / `Done` / `Risk`
- [x] Typography: Fraunces (serif), Inter (sans), Instrument Serif (display), JetBrains Mono (mono)
- [x] Legacy aliases mapped via `:root` (zero refactoring)
- [x] Topbar Ink 900, Sidebar Ink 700/800, CTAs Ember
- [x] `src/lib/tokens.ts` — JS/TS source of truth for colors
- [x] All Recharts charts aligned via `tokens.ts` (Dashboard, `Evolução`, `Exec.Financeira`, `Recursos`, PDS)

#### Shared libraries

- [x] `src/lib/rollup.ts` — dual thresholds N0-N3 + N4-N6 (later: 3-zone band thresholds in Wave 3 May 2026)
- [x] `src/lib/riskColors.ts` — 5-level gradient
- [x] `src/lib/healthRules.ts` — configurable PDS semaphore
- [x] `src/lib/invoiceHelpers.ts` — canonical invoice states
- [x] `src/lib/activityDependencies.ts` — cycle / date validation + BFS propagation + `computeDepGap` helper
- [x] `src/lib/tokens.ts` — Stratgos brand tokens
- [x] `src/lib/edgeFunctionError.ts` (May 2026) — `extractEdgeFunctionError` helper

#### Reusable components

- [x] `DateRangePicker`, `EmptyState`, `SplashScreen`, `Breadcrumb`, `DeviationBar`
- [x] **`NovoPlanoModal`** (May 2026) — shared plano wizard
- [x] **`DuplicatePlanoModal`** (May 2026) — deep-copy with hybrid time-shift
- [x] **`SearchableSelect`** — used for `Eixo` / `Owner` / `Sponsor` pickers
- [x] **`MultiPersonSelect`** (May 2026) — Linear / Notion style for owner / sponsor multi-value
- [x] **`InviteUserModal`, `EditUserModal`, `ConfirmModal`, `ForgotPasswordModal`** (May 2026)
- [x] **`CommandPalette`** — Cmd+K (currently plano search only; expansion planned)

#### Transversal UX

- [x] Empty states on 12 pages
- [x] Initial layout loading state (splash screen)
- [x] Clean topbar — no funnel icon (filters only via breadcrumb)
- [x] Single breadcrumb without duplication
- [x] Search in initiatives management with hierarchy preserved
- [x] Orphan plano (without activities) appears in the tree
- [x] Footer `"Powered by Stratgos"`

#### Transversal features (already done earlier)

- [x] Enforce granular permissions
- [x] Standardise loading states
- [x] Global toast system (4 types)
- [x] Configurable delay threshold (dual: N0-N3 default 20, N4-N6 default 0; 3-zone band since Wave 3 May 2026)
- [x] Global `.styled-select` + `.styled-select-sm`
- [x] Global `.status-pill` (88px min-width)

-----

## Phase 13.5 — Design System Consolidation

### ✅ Phase 1 — Token vocabulary established (April 30)

- [x] `src/styles/tokens.css` created (67 tokens, 10 sections)

### ✅ Phase 2 — Mechanical migration

- [x] Hardcoded hex / rgba colors migrated to tokens (77 colors)
- [x] Font-size literals migrated to `--text-*` tokens (429 occurrences)
- [x] Inline shadow values migrated to `--shadow-*` tokens (9 occurrences)
- [x] `#B34B36` button hover migrated to `--stratgos-ember-dark`

### ✅ Phase 3 — Component unification

- [x] Global `.btn` / `.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-lg` (19 duplicate classes eliminated, 47 usages migrated)
- [x] `.btn` variants `inline-flex` fix for icon alignment
- [x] 2 brand violations corrected (Login + DateRangePicker)
- [x] Unified table headers (Phase 4.5b.1 + 4.5b.2)

### 🟢 Phase 4 — Type scale applied (substantial)

- [x] Display-tier font-size tokens added (Phase 4 + 4.5a)
- [x] Utility classes in `src/styles/typography.css`
- [x] KPI numbers migrated to utility classes
- [x] Page titles, card section labels, body text migrated where applicable
- [ ] Decision pending: Display XL (Instrument Serif 88px) — keep for hero / exports or remove
- [ ] Decision pending: Body L (Fraunces 18px) — confirm editorial-only usage
- [ ] Decision pending: Mono font — JetBrains vs system mono
- [ ] `.t-body-l` selective application to `Visão Executiva` narrative

### ✅ Phase 13.5.5 — Admin icons + emoji → Lucide (done)

- [x] 57 `adm-icon-btn` usages confirmed using Lucide icons
- [x] Emoji literals (`✓`, `✕`, `📎`, `🔗`) eliminated from `.tsx`/`.ts`

### ✅ Phase 13.5.7 — Forge Deep v5 palette (May 2026)

Forge Deep v5 supersedes the Subtle Warm Family (v4). Driven by need for stronger semantic distinction between status colors and brand CTA color.

- [x] **Surfaces:** stone scale (`#FAFAF9` bg / `#FFFFFF` surface / `#F5F5F4` surface-2) — cooler than warm parchment v4
- [x] **Ink scale:** navy deep (`#0B1220` ink-900 topbar / `#1E2A44` ink-800 sidebar / `#2A3654` ink-700 / `#475369` ink-500 / `#A1A9B8` ink-300 / `#CBD2DC` ink-200 / `#E4E7EC` ink-100)
- [x] **Ember:** `#C8553D` unchanged + new tokens `--stratgos-ember-hover: #B14A36` and `--stratgos-ember-soft: #FDF4F1`
- [x] **Late color → Crimson `#9B2D2D`** (was `#B84A3F` terracotta — too close to ember)
- [x] **Status tints:** rgba updated for new Crimson
- [x] **Chips delta:** `KpiCard.css` + `SmartKpi.css` use `--status-ontrack-tint` / `--status-late-tint`
- [x] **Legacy aliases preserved**
- [x] **Applied to landing first** (stratgos.com) then to webapp
- [x] **`PlanosCatalog` progress bars** now color by status
- [x] **`GestaoIniciativas` STATUS_BADGE bug fix:** `"Concluída"` / `"Em dia"` colors swapped — fixed

### 🟡 Phase 13.5.6 — Ghost / link buttons (pending)

- [ ] 5 ghost buttons with different intent — decide case by case
- [ ] CSS class proposals + audit usage

### CLAUDE.md adjustment

- [x] **Done in Wave 6d (May 2026):** Brand Identity section updated to Forge Deep v5

-----

## Phase 13.6 — Stratgos rename (in progress)

### ✅ Phase A — Frontend visible (April 30)

- [x] Layout footer `"Powered by Strategos"` → `"Powered by Stratgos"`
- [x] SplashScreen alt + fallback text
- [x] Admin export filename `Strategos_export_*.xlsx` → `Stratgos_export_*.xlsx`
- [x] TODO.md / README title

### 🟡 Phase B — Internal identifiers (deferred)

- [ ] TypeScript types, function names, comments
- [ ] `package.json` “name” field
- [ ] File / folder renames (decision: defer or keep)
- [ ] Repository rename on GitHub (Strategos → Stratgos)
- [ ] Cloudflare Pages project rename
- [ ] Working directory rename on user’s Mac — manual `mv`
- [ ] Environment variables (if any `STRATEGOS_*` exist)

-----

## Phase 13.7 — Cmd+K command bar expansion

> Inspired by Linear’s command palette. Existing E2 implementation only searches plans; expand to full contextual command bar.

### Pending decisions

- [ ] Structure: flat (all commands always visible, fuzzy filter) vs hierarchical (context first, others expandable) vs hybrid
- [ ] Scope of global keyboard shortcuts: only Cmd+K, or also `N` (new), `G+D` (go dashboard), etc.
- [ ] Discoverability of shortcuts: visible to the right of each command (Linear-style)

### Contextual command coverage

- [ ] Dashboard: go to Plan X · New plan · View Executive Summary
- [ ] `/planos` catalog: New plan · Filter by status · Sort by date
- [ ] `PlanoPage` (any tab): Edit plan · Go to `Visão Executiva` / `Actividades` / PDS / `Riscos` / `Recursos` / `Financeira`
- [ ] `Actividades` tab: New activity · Expand all · Collapse all · Filter by status
- [ ] Activity modal open: Add dependency · Change level · Delete
- [ ] PDS tab: Add commitment · Add progress · Next step · Attention point
- [ ] `Riscos` tab: New risk · Filter critical · Sort by mitigation
- [ ] `Recursos` tab: Add person · Add FTE pool
- [ ] `Financeira` tab: New budget line · Log cost
- [ ] Sidebar global navigation: Go to Dashboard · PDS · `Riscos` · etc.

### Foundation

- [ ] Recent / pinned commands surface at top
- [ ] Keyboard shortcut hints visible per command
- [ ] Hierarchical entry (e.g. “Create issue” → subpalette)

-----

## Phase 13.8 — Activity Dependencies polish (continuation)

- [ ] **G3:** status propagation — predecessor `"Em atraso"` → successor inherits visual alert
- [ ] Allow adding dependencies in new mode (transaction with FK that doesn’t exist yet)
- [ ] Threshold gap configurable per program (currently hardcoded 7 days)
- [x] Migration 028 confirmed at `supabase/migrations/028_create_activity_dependencies.sql`
- [ ] Level cascade — promote / demote activity with automatic child re-parenting

-----

## Phase 13.9 — Other pending decisions

- [ ] **PDS rename:** `"Gestão PDS"` → `"Pto. de Situação"` (keep `/pds` route)
- [ ] **PDS truncate:** items with > 4 lines → truncate + `"Ver mais"` (see more) inline
- [x] **PDS card structure:** Option C hybrid — DONE
- [x] **`PontoSituacao` bug:** Option C applied — DONE
- [ ] **Role rename:** `editor` → `project_manager` (DB + frontend + migration); captured in canonical Glossary
- [x] **Copy unification:** `"vs 7d"` → `"últimos 7 dias"` (last 7 days) — DONE
- [ ] **D2:** `/orcamento-programa` page (4 tabs: `Resumo`, `Distribuição`, `Configuração`, `Execução`)
- [ ] **D3:** carryovers between years (hybrid model, rules to define)
- [ ] **E1:** adaptive breadcrumb (formal navigation mode)
- [x] **E3:** eliminate legacy menus — 4/5 done via Waves 5a/5b/5c/6
- [x] **KPI hero alignment (May 2026):** `variant="hero"` to `KpiCard` component, applied to `Actividades` + `Evolução` + `GestaoFinanceira` + `BudgetPage`
- [x] **`GestaoFinanceira` + `BudgetPage` rework (May 2026):** `"Desvio"` (deviation) → `"Orçamento Disponível"` (available budget) with new formula
- [x] **Cross-app UI renames (May 2026):** `"Iniciativa(s)"` → `"Actividade(s)"`, `"Pessoas"` → `"Recursos"`, `"Execução média"` → `"Grau de Execução"`
- [x] **`NovoPlanoModal` Step 2 emoji** 📎 → Lucide Paperclip — done in Wave I (`8af8465`)

-----

## Phase 13.10 — Wave 8: People & owner/sponsor (deferred until real data)

### Audit completed May 2026 — findings

- `people` table essentially empty
- `planos.owner` / `sponsor` are informal text
- 0/4 `fte_resources` linked via `person_id` (FK infra unused)
- `activities.owner` / `sponsor` exist in schema but unused (0/40 rows)
- `type` column semantically broken — fixed in Wave 8a
- Owners can be **persons OR areas** — model must support both
- Decision: `owner` / `sponsor` stays as `text` with `|` separator (multi-value), free entry allowed

### Sub-waves (priority order)

- [x] **8a (mini-cleanup) — DB confirmed May 26 2026:** `people.type` no longer exists; `people.company text` and `people.is_external boolean NOT NULL DEFAULT false` already in schema. Phase 13.10 Sub-Wave 8a is effectively complete — no further migration needed before Owner Update Form MVP.
- [x] **8d (mini-cleanup):** drop `activities.owner` / `sponsor` legacy columns — DB confirmed dropped; insert payload cleaned (`d8dc1e5`)
- [ ] **8.0 (gating):** populate `people` and `unidades` with real data — prerequisite to 8b
- [ ] **8b (after 8.0):** polish Admin / `Pessoas` (active toggle, notes edit, internal / external selector)
- [x] **8c (done in May 2026 — bug #1):** owner / sponsor multi-source picker via `MultiPersonSelect` (`898d512` + `ca2e255`)

-----

## Phase 13.11 — Profile + Auth / Account Management

### ✅ D1 wave — Profile page (`9040375`)

- [x] New `/profile` route (auth-gated) with avatar dropdown

### ✅ D2 wave — Admin polish + Pessoas linking (`c184a8a`)

- [x] `viewer` → `stakeholder` (M032), invite default unified, admin-row buttons disabled, `Pessoas` `profile_id` editable

### ✅ Wave H — Plan-level permissions (`08d642c` + `6de9ebe`)

- [x] `usePermissions` accepts optional `planId`; M033 + M034; `UserPermissionsModal`; embedded pages wired

### ✅ Profile reactive to auth state (`e7b7a35`)

### ✅ Admin User Lifecycle wave (May 2026)

- [x] 4 Edge Functions deployed via Supabase Dashboard
- [x] `InviteUserModal`, `EditUserModal`, `ConfirmModal` components
- [x] `SetupPassword` + `ResetPassword` pages
- [x] Custom email templates in PT-PT

### ✅ Done

- [x] **Forgot password (logged-out flow)** (`63ffb57`)

### 🟡 Pending

- [ ] **DB trigger `people.email` ↔ `profiles.email` auto-sync** (currently only admin-side syncs via Edge Function)
- [ ] **Notifications (workspace):** future 5th section inside `Plano` tab
- [ ] **Notifications (personal):** future section inside Profile page
- [ ] **2FA:** future security wave
- [ ] **Avatar photo upload:** future surface improvement
- [ ] **`Evolução` snapshot plan-level filtering:** today `by_n1` filtered by program but does NOT respect plan-level restrictions
- [ ] **`by_n2` (plan-level breakdown) UI:** snapshot field exists but unused
- [ ] **Aggregation RLS hardening (Option B):** plan-level enforcement at DB layer
- [x] **Custom SMTP (Resend, May 26 2026):** Resend native Supabase integration; `stratgos.com` domain verified with DKIM + SPF via Cloudflare native integration; 3000 emails/month free tier; sender `noreply@stratgos.com` (display name `Stratgos`); verified end-to-end via password reset flow
- [ ] **Apply `ConfirmModal` to `UserPermissionsForm` sub-action** (line 128, nested modal complication)

-----

### 🔴 High priority pending

- [ ] Topbar reads client title / logo dynamically from `app_config`
- [ ] `Gestão de Iniciativas`: convert to global drawer / modal accessible everywhere

### 🟡 Medium priority

#### Transversal features

- [ ] Filter button badge showing number of active filters
- [ ] Unsaved changes warning when navigating away
- [ ] Sortable table columns in all management pages
- [x] **Replace `window.confirm` with custom modal** (May 2026): 7 migrated to `ConfirmModal`; 1 sub-action kept
- [ ] Global “quick add” drawer (activity, risk, PDS from any page)
- [ ] Transversal save pattern — review all menus

#### Per menu

**Dashboard**

- [ ] Conditional colors on KPIs
- [ ] Click bar chart to filter by `Eixo`

**Financial Execution**

- [ ] CAPEX / OPEX breakdown per plan
- [ ] Consolidated program view with drill-down

**PDS**

- [ ] Side-by-side PDS comparison
- [ ] Export PDS to PDF
- [ ] Apply deviation-first to activity tables

**Resources**

- [ ] Resource ending alerts visual (30 days)

**Evolution**

- [ ] Flexible snapshot A vs B comparison
- [ ] Apply deviation-first to comparison table

### 🟢 Low priority

- [ ] Sidebar active item more prominent when collapsed
- [ ] Global card padding / density review
- [ ] Standardise keyboard shortcuts (Enter / Escape in all inline forms)
- [x] 404 page (May 2026) — `NotFound.tsx` + catch-all `*` route done

### UX / UI — Apple HIG

> This section retains PT-PT where it cites UI strings.

- [ ] Rename technical labels (BS → `Início Planeado`, etc.) — partially done in modal
- [ ] Visible legend for column C / D / A
- [ ] Tooltips on sidebar icons when collapsed
- [ ] `Actividades` / Gantt: indentation and background color per level
- [ ] Dashboard table: consistent styles
- [ ] Animated transitions between pages (fade 150ms)
- [ ] Re-validate contrast post-Stratgos (WCAG AA)
- [ ] Keyboard navigation in modals (Tab focus, Escape closes)
- [ ] ARIA attributes on interactive components

### UX / UI — NN/g Heuristics

> This section retains PT-PT where it cites UI strings.

- [ ] H2: technical labels → natural language
- [ ] H3: warning when closing modal with unsaved changes
- [ ] H5: real-time validation in forms
- [ ] H6: required fields visually identified
- [ ] H7: keyboard shortcuts — covered by Phase 13.7
- [ ] H9: error messages in natural language (not Supabase technical errors)
- [ ] H10: explanatory tooltips on less obvious fields

### UX / UI — IBM Carbon Design System

- [ ] Sortable columns on all tables
- [ ] Numeric values right-aligned
- [ ] Pagination for tables with 50+ rows
- [ ] Condensed mode (toggle `"Vista compacta"` — compact view)

### UX / UI — Modern visual components

- [x] Date range picker ✅
- [x] Gantt tooltip with auto-flip ✅
- [x] Inline mini progress bar (`DeviationBar`) ✅
- [ ] Circular gauge for `% Execução`
- [ ] Visual semaphore (3 circles) for status
- [ ] Stacked horizontal mini bars by color for C / D / A
- [ ] Sparkline on Dashboard KPIs
- [ ] Avatar with initials for `Responsável` / `Sponsor`

### Admin — Rethink metrics management

- [ ] Consolidate thresholds + health limits + invoice alerts
- [ ] `"Configuração de Inteligência"` (intelligence configuration) section (linked to Phase 14)
- [ ] Visual design with real-time preview
- [ ] Full configurable rules engine (OR / AND + toggles)

### General

- [ ] Dark mode (Stratgos tokens already prepared)
- [ ] Mobile responsive (bottom nav) / PWA / native app — discussion paused mid-May 2026 (sequence A → B → C agreed: React responsive polish → PWA if real demand → native only if commercial justification)
- [ ] Generalised Excel import / export
- [ ] Real-time updates (Supabase subscriptions)
- [ ] Performance optimization
- [ ] Owner Update Form (email-driven update flow for plan owners without platform access) — see Phase 13.12 for full design and decision capture

-----

-----

## Phase 13.12 — Owner Update Form (Sub-fase 1.4 — ready to start)

Email-driven update flow that allows plan owners without platform access to update their plans via a one-time token link. **Status (May 26 2026):** all prerequisites complete (Wave 8a, owner/sponsor refactor, Resend SMTP) and all decisions closed. MVP implementation will span ~3 sessions (~28h estimated).

### Use case

PMO / Program manager cannot keep plan data current if owners don't have platform access. Email-driven update is the standard SaaS pattern for this (parity with Asana, Jira via Atlassian Smart Links, Smartsheet forms, Monday.com Updates) — but Stratgos differentiates by collecting a **full PDS-like update** (not just status %).

### Final flow

1. PMO/Gestor clicks `"Pedir actualização"` on a plano in `PlanoPage` or `PlanosCatalog`
2. If plano has multiple owners, modal asks PMO to pick who to invite (decision #6)
3. System generates a unique token + sends email via Resend SMTP on `stratgos.com` domain: `"Olá [Nome], por favor actualize o estado de [Plano X]: <link>"`
4. Owner clicks link → opens `/update/<token>` (public page, mobile-first, no app shell)
5. Owner sees plan + activities + current state → fills in:
   - `% Execução` per activity
   - Real dates per activity
   - 4 PDS textareas: Compromissos, Avanços, Próximos Passos, Pontos de Atenção (with useful placeholders)
6. Owner submits → creates draft in DB
7. PMO receives notification (in-app + email) → reviews draft side-by-side with current → accepts or rejects
8. Token is single-use, expires after 7 days

### All decisions closed

| # | Decision | Final |
|---|---|---|
| 1 | Workflow approval | Draft + PMO approval (controlo qualidade) |
| 2 | Granularity | Por plano |
| 3 | Form scope | % + datas reais + PDS completo (4 secções) |
| 4 | Re-scoping | Core product feature (não polish) |
| 5 | Data state | Dummy — clean migrations OK |
| 6 | Multi-owner | PMO escolhe quem convidar no momento |
| 7 | Data model | B-adaptado — `_person_ids[]` + `_primary_id` + `_label_override` applied symmetrically to owner AND sponsor ✓ implemented |
| 8 | Authentication | Single-use UUID token, 7-day expiry |
| 9 | SMTP provider | Resend (chosen for native Supabase integration + 99.2% deliverability + 3000/mo free tier) ✓ configured |
| A | Activity-level granularity | All activities of the plano editable by the owner (no per-activity owner) |
| B | Free text format | 4 textareas with useful placeholders |
| C | Rate limit | 1 request per (owner, plano) per 7 days, configurable in Admin |

### Prerequisites complete

- ✅ **Owner/sponsor data model refactor** (3 commits, this session) — `planos.owner_person_ids[]` + `owner_primary_id` + `owner_label_override` (same for sponsor)
- ✅ **`src/lib/owners.ts` helper** — `resolveOwnerPrimaryEmail()` to resolve who receives the email
- ✅ **Custom SMTP via Resend** on `stratgos.com` domain — verified DKIM + SPF, native Supabase integration
- ✅ **Audit log infrastructure** — already in place via `change_log` and existing audit hooks

### Sub-fase 1.4 sequencing — components & effort

**Componente A — Backbone técnico (~10h, 1 session)**

| Step | Component | Effort |
|---|---|---|
| A1 | DB schema `update_tokens` + RLS | ~1h |
| A2 | Edge Function `send-update-request` | ~3h |
| A3 | Edge Function `submit-owner-update` | ~3h |
| A4 | Email template PT-PT (HTML, brand Stratgos) | ~2h |
| A5 | Rate limit logic | ~1h |

**Componente B — Formulário público (~8h, 1 session)**

| Step | Component | Effort |
|---|---|---|
| B1 | Página `/update/:token` (token validation, error states) | ~1h |
| B2 | Layout responsive mobile-first | ~2h |
| B3 | Form fields: % + datas | ~2h |
| B4 | Form fields: 4 textareas PDS | ~2h |
| B5 | Submit + thank-you page | ~1h |

**Componente C — UI PMO (~10h, 1-2 sessions)**

| Step | Component | Effort |
|---|---|---|
| C1 | Botão `"Pedir actualização"` no PlanoPage | ~1h |
| C2 | Modal "Quem queres convidar" (multi-owner picker) | ~2h |
| C3 | Confirmação + envio + toast | ~1h |
| C4 | Lista de "Updates pendentes" (drafts) | ~3h |
| C5 | Revisão de draft: side-by-side current vs proposed | ~2h |
| C6 | Aceitar/Rejeitar com audit log | ~1h |

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Token leaked via email forward | Token one-time + 7-day expiry + audit log |
| Owner submits wrong data | PMO review workflow (decision #1) |
| Spam of update requests | Rate limit (decision C): 1/(owner,plano)/7d configurable |
| Mobile form complexity | Single-page UX, max 4 textarea fields |
| Supabase email rate limit (4/hour) | Resend SMTP resolved ✓ |
| Owner has no email associated | Wave 8a + decision #7 cover the case |

### Strategic value

**For clients:** raises plan data freshness without PMO chasing owners; owners held accountable via email tracking; automatic audit (who updated, when, via update flow).

**For Stratgos:** competitive differentiator (PDS-like update, not just % status); raises engagement (more indirect users); potential paid feature (e.g. update request quota tied to plan tier).

### Deferred for after MVP

- **Auto-trigger:** cron-like job that sends update-requests for stale planos (> N days). Infrastructure: Supabase `pg_cron` or external scheduler. Configurable threshold per program in Admin. **Not in MVP** — adds 2-3h work.
- **Multi-language email templates:** PT-PT-only for MVP; EN translation deferred.


### Use case

PMO / Program manager cannot keep plan data current if owners don’t have platform access. Email-driven update is the standard SaaS pattern for this (parity with Asana, Jira via Atlassian Smart Links, Smartsheet forms, Monday.com Updates).

### Proposed flow

1. PMO / Program manager clicks `"Pedir actualização"` (request update) on a plan or activity (or automatic trigger when plano stale > X days)
1. System generates a unique token (UUID) + sends email to owner: `"Olá [Nome], por favor actualize o estado de [Plano X]: <link>"`
1. Owner receives email, clicks link → opens `/update/<token>` (public, no login, but token-signed) → sees plan + activities + current state → can update fields
1. Owner submits → system validates token + applies update + notifies PMO via email / dashboard → token expires (one-time or time-limited)

### Decision captured

**Scope of the form (if proceeded):** `% + datas reais + ponto de situação` (commitments, key progress, next steps, and attention points are critical). This is option C-equivalent from the original analysis — not just percentage, not just dates, but a structured PDS-like update.

**Status:** “Discutir mais detalhe primeiro (escopo, owner data model)” — design captured, decision deferred until prerequisites resolved.

### Owner data model — 3 paths (decision pending)

Today, `planos.owner` and `planos.sponsor` are `text` (free-form, `"Adm.2 | Adm.1"` for multi-value), while `people` table has `email` field (nullable, sometimes empty). For email-driven flow to work, owner names must resolve to emails.

|Path |Approach                                                                                                     |Effort|Risk              |Final cleanliness|
|-----|-------------------------------------------------------------------------------------------------------------|------|------------------|-----------------|
|**A**|Lookup by name (split `planos.owner` by `|`, lookup `people.name = name`)                                    |XS    |Low               |Stays messy      |
|**B**|Migrate `planos.owner` → `planos.owner_person_ids[]` (FK array)                                              |M     |Medium (migration)|**Clean**        |
|**C**|Hybrid: add `planos.owner_person_id` (nullable FK) + fallback to text; email-driven only when FK is populated|S     |Low               |Clean eventually |

### Effort breakdown

|Component                                                 |Effort|Notes                                            |
|----------------------------------------------------------|------|-------------------------------------------------|
|DB schema (`update_tokens` table)                         |S     |token, plano_id, owner_email, expires_at, used_at|
|Edge Function `send-update-request`                       |M     |Generate token + send customized email           |
|Edge Function `submit-owner-update`                       |M     |Validate token + apply update + audit log        |
|Public page `/update/:token`                              |M-L   |Update form (responsive, no app layout)          |
|PMO UI (request button + list of pending requests)        |M     |In `PlanoPage` and `Actividades`                 |
|Automatic trigger (cron-like for stale planos)            |M     |Supabase pg_cron or external scheduler           |
|Email templates in PT-PT                                  |S     |Existing infrastructure                          |
|Edge case validation (token expired, plano archived, etc.)|M     |                                                 |
|**TOTAL**                                                 |**L** |**1-2 weeks**                                    |

### Prerequisites

1. **People table consolidated with emails** — Waves 8a / 8b in current TODO roadmap
1. **Custom SMTP** — Supabase free tier 4 emails / hour does not scale; needs Resend or SendGrid
1. **Audit log infrastructure** — already in place via `change_log`

### Critical decisions still open

1. **Authentication:** unique token URL (one-time, 7-day expiry, standard SaaS) vs Supabase magic-link auth (more robust but requires owner account) vs token + 6-digit email code (extra secure)
1. **Validation workflow:** auto-apply owner updates vs PMO approval step before commit
1. **Mobile UX:** owners may respond from phone — form must be 1 page, max 4 fields
1. **Trigger threshold:** how many days before auto-request

### Risks and mitigations

|Risk                                |Mitigation                                    |
|------------------------------------|----------------------------------------------|
|Token leaked via email forward      |Token one-time + 7-day expiry + audit log     |
|Owner submits wrong data            |PMO review workflow + validation              |
|Spam of update requests             |Rate limit per owner email                    |
|Mobile form complexity              |Single-page UX, max 4 fields                  |
|Supabase email rate limit (4 / hour)|Custom SMTP resolves                          |
|Owner has no email associated       |Wave 8a / 8b people consolidation prerequisite|

### Strategic value

**For clients:** raises plan data freshness without PMO chasing owners; owners held accountable via email tracking; automatic audit (who updated, when, via update flow).

**For Stratgos:** competitive differentiator; raises engagement (more indirect users); potential paid feature (e.g. update request quota tied to plan tier).

### Recommendation captured

Ideal sequence is: Wave 8a (people consolidated with email) → Custom SMTP (Resend or SendGrid) → Owner Update Form (large wave, 1-2 weeks) → Auto-trigger built on existing Alerts infrastructure (Admin Plano tab). MVP could start smaller (percentage-only updates, no auto-trigger, specific plans) in 3-4 days.

-----

## Phase 14 — AI & Intelligence Features

### Predictive analytics

- [ ] Projected completion date per plan
- [ ] Early warning for decelerating plans
- [ ] Financial year-end projection

### Pattern detection

- [ ] Chronically delayed plans
- [ ] Over-allocated resources
- [ ] Growing financial deviation trend

### AI-generated summaries

- [ ] Auto-generate PDS text from data
- [ ] Weekly executive summary
- [ ] AI-suggested next steps

### Scoring & prioritisation

- [ ] Health score per plan (0-100) — partially done via PDS semaphore
- [ ] Plan ranking dashboard
- [ ] Risk prioritisation by trend

### Alerts & notifications

- [ ] Status change notifications
- [ ] Invoice due date alerts — backend ready in `invoiceHelpers.ts`
- [ ] Daily email summary

### Benchmarking

- [ ] Cross-program comparison
- [ ] Temporal comparison
- [ ] Plan type success rates

## Phase 14.5 — Alerts & Interactions (Pipeline)

- [ ] Alert deep-links: auto-apply filters from navigation (breadcrumb state)
- [ ] Snooze / Acknowledge alerts (new `alert_actions` table, Option B + C)
- [ ] `ResizeObserver` for dynamic card heights (currently 280px fixed)
- [ ] Plano dropdown: search + grouping by `Eixo` (when > 20 planos)
- [ ] URL params for shareable deep-links (Phase 6)
- [ ] Inventory of local filters on pages (redundancy with breadcrumb)
- [ ] Secondary breadcrumb (statuses / owners / sponsors) decision: always visible vs toggle
- [ ] Language standardization (backend PT + EN mixing, deferred)

-----

## Phase 14.6 — Onboarding documentation (indefinite standby)

Discussed in May 2026 session. MVP scope ~1 week when started. Standby until real users start coming in OR demo commitment.

### MVP scope

- 3 core guides (in draft in a prepared Google Doc, `stratgos-onboarding-guides-template.docx`):
  - How to create a `Plano` (Owner / Sponsor)
  - How to update an `Actividade` (Executor)
  - How to read the Dashboard (Viewer)
- Glossary review (`/glossary` already exists)
- Implementation: `/help` route in the webapp

### Deferred decisions

- [ ] Technical approach: interactive walkthrough (Shepherd.js / Driver.js) vs static page vs contextual tooltips
- [ ] Recommended pre-work: fill out the 3 guides in free-form text before implementing code (separates “what to say” from “how to show”)

-----

## Phase 15 — Multi-tenancy (SaaS)

- [ ] Supabase DEV vs PROD separation (separate projects, env vars in Cloudflare) — **blocked by macOS 11 limitation; Supabase CLI requires macOS 12+**
- [ ] Create `organizations` table
- [ ] Add `org_id` to all data tables
- [ ] RLS filtering by `org_id`
- [ ] Admin per organization
- [ ] Approach: `org_id` column (standard SaaS)
- [ ] Dashboard modular / configurable per tenant
- [ ] Edge Function for invite-user (already exists for current model; will need `org_id` awareness)
- [ ] **Cobranding modes** (per Brand Identity v1.0): stratgos / cobrand / whitelabel
- [ ] Plan-level RLS hardening (Option B) — currently frontend-only

-----

## Phase 16 — Public Landing + Domain Setup ✅ (May 2026)

Stratgos public marketing site at `stratgos.com`, separate from the webapp.

### Infrastructure

- [x] **Domain registered:** `stratgos.com` via Cloudflare Registrar
- [x] **Repo:** `MiguelPC90/stratgos-landing` (private GitHub repo, Astro 4 stack)
- [x] **Deploy:** Cloudflare Pages with auto-deploy from `main` branch
- [x] **DNS:** `stratgos.com` + `www.stratgos.com` with 301 redirect (`www` → root)
- [x] **HTTPS:** automatic via Cloudflare

### Email infrastructure

- [x] **Cloudflare Email Routing:** `hello@stratgos.com` → forward to `migcacoelho@gmail.com`
- [x] MX records auto-configured (free with Cloudflare Registrar)
- [x] No SMTP server needed — zero infrastructure cost

### Form backend

- [x] **Formspree:** `https://formspree.io/f/mdajobnr` endpoint (free tier, 50 submissions / month)
- [x] Submissions forward to `hello@stratgos.com` → Cloudflare routing → Gmail
- [x] End-to-end tested

### Landing content (Astro 4 standalone)

- [x] **Source:** extracted from Claude Artifact bundle (989 KB self-contained HTML)
- [x] **Brand assets:** `stratgos-mark.png` + `stratgos-primary.png` trimmed
- [x] **Favicons:** regenerated via PIL.LANCZOS at 3 sizes
- [x] **Forge Deep v5 palette** applied to landing CSS
- [x] **Bilingual PT / EN** via `data-pt` / `data-en` attributes with vanilla JS toggle
- [x] **Hero mockup** with KPI dashboard, mini gantt, stats counters (HTML / CSS, no images yet)
- [x] **3 features sections** with HTML / CSS visual mocks

### Strategy

- [x] Architecture decision: `stratgos.com` → landing; `app.stratgos.com` → webapp (PENDING — depends on DEV / PROD split)
- [x] Workflow: iPad-only setup (Cloudflare Dashboard + GitHub Web UI + Astro static deploy) — no Mac needed for landing operations

### Pending

- [ ] **Real screenshots:** capture webapp views and replace HTML / CSS mocks
- [ ] **Custom domain `app.stratgos.com` → webapp:** depends on DEV / PROD split (Phase 15 precursor)
- [ ] **Landing evolution to company-level:** when Phylax (or other Stratgos products) launches

-----

## Glossary — Stratgos canonical vocabulary (v2, May 2026)

Single source of truth for product vocabulary. Used to align UI strings, code identifiers (gradually), documentation, and external copy (landing, emails). **This glossary is authored in PT-PT by design** — it defines the canonical UI vocabulary of the product.

Stored at: `stratgos-glossario-v2.md` (artifact, not versioned in repo yet)

### 13 sections covered

1. **`Estrutura organizacional`** (organizational structure): `Programa` → `Eixo` → `Plano` → `Actividade` → `Tarefa`
1. **`Estados de Actividade`** (activity states): `Em dia` · `Em risco` · `Em atraso` · `Concluída`
1. **`Estados de PDS`** (PDS states): `Pendente` · `Em curso` · `Concluído`
1. **`Métricas de Execução`** (execution metrics): `Grau de Execução` · `Concretização Geral` · `Concretização à Data` · `Objectivo`
1. **`Financeiro`** (financial): `Orçamento` · `Adjudicado` · `Pago` · `Em Pagamento` · `Por Facturar` · `Orçamento Disponível`
1. **`Recursos`** (resources): `Recurso` · `Alocação` · `Sobrealocação` · `Capacidade`
1. **`Riscos`** (risks): `Risco` · `Severidade` · `Mitigação` · `Risco Crítico` · `Ponto de Atenção` · `A Requerer Atenção`
1. **`Dependências`** (dependencies): `Predecessor` · `Sucessor` · `Dependência`
1. **`Versões / Temporais`** (versions / temporal): `Snapshot` · `Baseline` · `Evolução` · `Prazo`
1. **`Documentos`** (documents): PDS · `Ponto de Situação` · `Resumo Executivo` · `Visão Executiva` · `Factura`
1. **Roles:** `admin` · `program_manager` · `project_manager` · `stakeholder` · `sponsor`
1. **`Verbos`** (verbs): `Remover` (disassociate) vs `Eliminar` (permanent delete) · `Editar` · `Duplicar` · `Importar` · `Exportar` · `Convidar` · `Criar`
1. **`Visualizações`** (visualizations): Gantt · Heatmap · `Tabela` · Cards · Dashboard

### Deprecated terms

- `"Iniciativa"` (initiative) → `"Actividade"` (activity)
- `"Pessoa"` (person) → `"Recurso"` (resource) in PMO usage
- `"Deadline"` → `"Prazo"` (deadline / due date)
- `"Execução média"` / `"Exec. real"` (average execution) → `"Grau de Execução"` (degree of execution)
- `"Desvio"` (deviation, financial) → `"Orçamento Disponível"` (available budget)
- BL / AR / RF — not introduced

### Pending

- [x] **`/glossary` standalone page** (May 2026) — done; route in production
- [x] **Contextual tooltips** (May 2026) — done via `TermTooltip` component; see Tooltips Wave below
- [ ] **Cross-app UI rename audit** — extend renames beyond initial wave
- [ ] **`DeadlineCell` component rename → `PrazoCell`** (internal identifier, low priority)
- [ ] **Verb consistency audit** — `Remover` vs `Eliminar` applied per glossary definition

-----

## Loose ends — Resolve before production

### ✅ Resolved (summary)

Extensive history already resolved up to May 2026: `rollup.ts` dual + 3-zone band thresholds, RLS Phase 1-5, breadcrumb cascade, Wave H plan-level permissions, Edge Functions user lifecycle, Forge Deep v5 palette, etc. Details in the `Session updates` above.

### Pending

- [ ] Separate DEV and PROD environments (Phase 15) — blocked by macOS 11
- [ ] **Wave E — Import hardening:** transactional, FK validation, clear-first toggle, idempotent re-imports
- [ ] Threshold cascade validation — only works in one direction
- [ ] **Rename PT → EN files:** `Actividades`, `Recursos`, `Evolucao`, `PlanoPage`, `PlanosCatalog` → `Activities`, `Resources`, etc. (convention: code in English, UI in PT)

-----

## Operational notes

### Workflow & sync

- `supabase/migrations/` lives **only in the `_Dev` repo**. The sync workflow also copies `supabase/` to the Mac (not just `src/`).
- **Before each wave,** ask Claude Code to do `git merge main` on its branch. Otherwise, fixes applied locally on the Mac may be silently reverted by an out-of-date `_Dev` branch on the next sync.
- **`TODO.md` sync nuance:** `TODO.md` in `_Dev` is edited by Claude Code; `TODO.md` on the Mac may diverge. Reconcile manually.
- **Workflow correction (May 2026):** previously the merge-to-main was bundled into commit instructions, pushing untested code to production. Corrected: commit on `dev` → push → sync Mac + smoke test local → ONLY THEN merge to `main`.
- **Smoke test convention (May 2026):** for build / perf waves, validate with `npm run build && npm run preview` (not just `npm run dev`). Tailwind v4 + Vite have issues that only appear in production builds.

### Supabase

- **Edge Functions deploy via Supabase Dashboard** (macOS 11 Big Sur limitation): Supabase CLI requires macOS 12+. All Edge Functions are deployed via Dashboard copy-paste from source files in `supabase/functions/<name>/index.ts` (versioned in `_Dev` repo).
- **`FunctionsHttpError` gotcha:** response body lives in `error.context` (Response object), NOT `data.error`. Use the `extractEdgeFunctionError` helper.
- **Site URL config critical:** Edge Function `redirectTo` only respected if URL is in the Redirect URLs allowed list.
- **Email delivery:** Resend custom SMTP (May 26 2026) — resolved the 4 emails/hour free-tier limit. Sends from `noreply@stratgos.com` via Resend native Supabase integration. 3000 emails/month free tier.

### Domain & infrastructure

- **Cloudflare Email Routing:** `hello@stratgos.com` → forwards to `migcacoelho@gmail.com`. Free with Cloudflare Registrar.
- **Formspree integration:** receives form submissions from the public landing.
- **Landing repo isolation:** `stratgos-landing` is a separate private repo. Astro 4 static site. Edited via GitHub Web UI on iPad without Mac terminal.

### Platform

- **macOS 11 Big Sur limitation (expanded):** Supabase CLI requires macOS 12+. Modern Supabase CLI binaries fail at runtime with `dyld: Symbol not found: _ubrk_clone` on Big Sur. All workarounds attempted failed. **Net:** Edge Functions deployed via Dashboard, DEV / PROD split blocked until newer macOS access.

### Tech debt discovered (May 2026)

- **Tailwind v4 + Vite + lazy chunks:** layer ordering bug in production builds. Wave 7 (bundle splitting) reverted. Details in `CLAUDE.md` → Known Issues.
- **Multi-tab Supabase auth lock:** opening Stratgos in multiple tabs causes “Lock stolen”. Workaround: close tabs.
- **Gantt colgroup whitespace hydration warning:** pre-existing, low severity, deferred.

### Branding

- **`stratgos.com` vs `strategos`:** brand name is **Stratgos** (no `e`), but webapp repo + Cloudflare worker URL still use `strategos`. Landing uses correct spelling. Phase 13.6 Phase B cleanup deferred.

-----

## Git Workflow

- `main` — production (auto-deploys to Cloudflare)
- `dev` — Mac staging branch
- `claude/add-collaborative-database-LWmWB` — Claude Code dev branch
- Commit often, push frequently, merge to `main` when validated **and smoke-tested locally**

### Sync workflow (iPad → Mac)

```bash
cd /tmp
rm -rf temp-sync
git clone --no-checkout https://github.com/MiguelPC90/Strategos_SupaBase_Dev.git temp-sync
cd temp-sync
git checkout claude/add-collaborative-database-LWmWB
git log --oneline -5   # confirm latest commits before sync (avoid stale sync)

cp -r strategos/src ~/Strategos/strategos/
cp -r supabase ~/Strategos/strategos/    # critical: lives at _Dev root, not inside strategos/
cp strategos/package.json ~/Strategos/strategos/   # only if dependencies changed

cd ~/Strategos/strategos
rm -rf /tmp/temp-sync
npm install   # if package.json changed
npm run dev   # quick visual smoke test
# For build / perf waves: also npm run build && npm run preview
```

### Merge to `main` (only after local smoke test)

```bash
git checkout main
git merge dev
git push origin main
git checkout dev
```

-----

## Working notes

- User works mostly on iPad / iPhone during the day
- Final tests at the end of the day on the Mac
- Claude Code runs in dev branch
- Merge to `main` → Cloudflare auto-deploy (after local smoke test)
- Current users:
  - [migcacoelho@gmail.com](mailto:migcacoelho@gmail.com) — admin
  - [miguelstrategos@gmail.com](mailto:miguelstrategos@gmail.com) — program_manager
  - [vasco.candeias97@gmail.com](mailto:vasco.candeias97@gmail.com) — stakeholder