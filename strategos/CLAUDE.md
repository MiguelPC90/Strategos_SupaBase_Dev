# CLAUDE.md — Stratgos

> **Living technical manual.** This document describes the current state of the system: stack, schema, libraries, components, conventions, known issues. **No narrative history** — for changelog and roadmap, see `TODO.md`.
> 
> **Golden rule:** when something changes in the system, update this file **and** add a chronological note in `TODO.md`. If one of them lags behind, they will eventually drift apart and lose value.
> 
> **Language convention:** prose in English; PT-PT preserved for product domain terms (Plano, Eixo, Actividade, PDS, etc.) with inline English translation on first occurrence per section, and for UI strings cited literally between quotes.

-----

## Project Overview

Stratgos is a PMO (Project Management Office) dashboard for organizations managing strategic programs and projects. It provides executive summaries, activity tracking, Gantt charts, financial execution monitoring, resource management, risk management, and status reporting — all in a single web application.

**Tagline:** *Strategy made visible*

**Brand name:** **Stratgos** (without the `e`). The italic *g* occupies the place of the missing *e* in the wordmark. The typographic quirk IS the brand. Never spell it “Strategos”. (Note: repo / Cloudflare worker URL / `package.json` still use the legacy “Strategos” spelling — see Phase 13.6 Phase B in `TODO.md` for cleanup plan.)

-----

## Tech Stack

- **Frontend:** Vite 7 + React 19 + Tailwind CSS v4.2 + TypeScript 6 (strict)
- **Backend/DB:** Supabase (PostgreSQL + Auth + Row Level Security + Edge Functions)
- **Hosting:**
  - Webapp → Cloudflare Workers (`strategos.migcacoelho.workers.dev`), auto-deploy from GitHub `main`
  - Landing → Cloudflare Pages (`stratgos.com`), auto-deploy from `stratgos-landing` repo
- **Package manager:** npm
- **Build gate:** `npm run build` runs `tsc --noEmit && vite build` — zero TS errors required

-----

## Repositories & Live URLs

|Purpose             |Repo                                              |Branch                                   |Deployed to                        |
|--------------------|--------------------------------------------------|-----------------------------------------|-----------------------------------|
|Webapp (Mac)        |`github.com/MiguelPC90/Strategos`                 |`main` (prod), `dev` (staging)           |`strategos.migcacoelho.workers.dev`|
|Webapp (Claude Code)|`github.com/MiguelPC90/Strategos_SupaBase_Dev`    |`claude/add-collaborative-database-LWmWB`|(not deployed; sync to Mac)        |
|Landing             |`github.com/MiguelPC90/stratgos-landing` (private)|`main`                                   |`stratgos.com`                     |

The `_Dev` repo is where Claude Code operates. The Mac repo is the source of truth for production. Sync direction is `_Dev` → Mac (manual).

**Branching convention (Mac):** `dev` for staging, `main` for production. Cloudflare auto-deploys `main`.

-----

## Supabase

- **Project URL:** `https://wirokqtgrvlxwvypmbej.supabase.co`
- **Credentials:** `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- **Service role:** used only inside Edge Functions
- **DEV/PROD split:** **NOT YET** — single Supabase project for now. See Phase 15 in `TODO.md`.

### Email delivery (SMTP)

Custom SMTP configured via **Resend** native Supabase integration (May 26 2026). Resolves the free-tier rate limit (4 emails/hour) and enables sending from the `stratgos.com` domain.

- **Provider:** Resend (Europe region, AWS SES backend)
- **Sender:** `noreply@stratgos.com` (display name: `Stratgos`)
- **Domain authentication:** DKIM + SPF + MX via 3 DNS records on `stratgos.com`, added automatically by Resend's Cloudflare native integration (no manual copy-paste). All `DNS only` (not proxied through CDN), TTL 1hr.
- **Free tier:** 3000 emails/month (sufficient for MVP + early customer phase)
- **Setup:** Resend dashboard → Integrations → Supabase → Connect (OAuth flow auto-fills SMTP credentials in Supabase Auth settings; Resend API key generated automatically)
- **Verified workflows:** Supabase Auth emails (magic link, password reset, signup confirmation) ✓
- **Pending integration:** Owner Update Form Edge Functions will use the same Resend stack via the API (not just SMTP) for richer HTML email templates.

To check delivery in production: Resend dashboard → Emails (or Logs).

### Current users

|Email                                                          |Role           |
|---------------------------------------------------------------|---------------|
|[migcacoelho@gmail.com](mailto:migcacoelho@gmail.com)          |admin          |
|[miguelstrategos@gmail.com](mailto:miguelstrategos@gmail.com)  |program_manager|
|[vasco.candeias97@gmail.com](mailto:vasco.candeias97@gmail.com)|stakeholder    |

-----

## Roles (5 active, May 2026)

Migration 032 consolidated `viewer` into `stakeholder`. Current set:

|Role (DB)        |UI label (PT-PT)  |English meaning     |Capability                                     |
|-----------------|------------------|--------------------|-----------------------------------------------|
|`admin`          |Admin             |Admin               |Bypasses all checks; full read/write everywhere|
|`program_manager`|Gestor de Programa|Program manager     |Edits programs assigned to them                |
|`project_manager`|Gestor de Projecto|Project manager     |Edits planos assigned to them                  |
|`sponsor`        |Patrocinador      |Sponsor             |Reviews, comments, approves; limited edit      |
|`stakeholder`    |Visualizador      |Viewer / stakeholder|Read-only                                      |

`access_level` values per (user × program × page) tuple: `'full' | 'ops' | 'view' | 'view_ops' | 'denied'`.

`admin` always bypasses. `stakeholder` is always read-only regardless of access_level.

-----

## Brand Identity v1.1 — Forge Deep v5 (May 2026)

Forge Deep v5 supersedes the Subtle Warm Family (v4). Driven by need for stronger semantic distinction between status colors and brand CTA.

### Palette · Surfaces (cool stone scale)

|Token                 |Value    |Role                                            |
|----------------------|---------|------------------------------------------------|
|`--stratgos-bg`       |`#FAFAF9`|Page background                                 |
|`--stratgos-surface`  |`#FFFFFF`|Card / modal background (pure white for density)|
|`--stratgos-surface-2`|`#F5F5F4`|KPI surfaces, slightly recessed                 |

### Palette · Ink (navy deep)

|Token               |Value    |Role                                              |
|--------------------|---------|--------------------------------------------------|
|`--stratgos-ink-900`|`#0B1220`|**Topbar background** · primary brand · body text |
|`--stratgos-ink-800`|`#1E2A44`|**Sidebar background** (legacy alias: `--navy`)   |
|`--stratgos-ink-700`|`#2A3654`|Secondary surface · heading accent                |
|`--stratgos-ink-500`|`#475369`|Body text alternate · secondary labels            |
|`--stratgos-ink-300`|`#A1A9B8`|Tertiary text · placeholders · muted progress fill|
|`--stratgos-ink-200`|`#CBD2DC`|Subtle dividers                                   |
|`--stratgos-ink-100`|`#E4E7EC`|Dividers · disabled states                        |

### Palette · Accent (Ember)

|Token                   |Value    |Role                                                                        |
|------------------------|---------|----------------------------------------------------------------------------|
|`--stratgos-ember`      |`#C8553D`|**Accent · links · CTAs · italic g**                                        |
|`--stratgos-ember-hover`|`#B14A36`|Primary button hover (also exposed via legacy alias `--stratgos-ember-dark`)|
|`--stratgos-ember-soft` |`#FDF4F1`|Ember-tinted background (e.g. hover surfaces)                               |

### Palette · Semantic (status pills + status-driven charts ONLY)

> Brand and semantic palettes do not overlap. Semantic colors have ONE job each.

|Token             |Value    |Usage                                                                                       |
|------------------|---------|--------------------------------------------------------------------------------------------|
|`--status-ontrack`|`#4A7C59`|`"Em dia"` (on track) · positive signals · ✓ confirmations (legacy alias: `--stratgos-moss`)|
|`--status-late`   |`#9B2D2D`|`"Em atraso"` (late) — **Crimson, not terracotta** (clearly distinct from Ember CTA)        |
|`--status-done`   |`#2F5F8F`|`"Concluída"` (done)                                                                        |
|`--status-risk`   |`#C89A3C`|`"Em risco"` (at risk) / warning                                                            |

Tints (rgba 12-18% alpha): `--status-ontrack-tint`, `--status-late-tint`, `--status-done-tint`, `--status-risk-tint`.

### Legacy aliases (preserved for zero-refactoring)

|Old token                                             |Mapped to                     |
|------------------------------------------------------|------------------------------|
|`--navy`                                              |`--stratgos-ink-800` (sidebar)|
|`--bg`                                                |`--stratgos-bg`               |
|`--bg2`                                               |`--stratgos-surface`          |
|`--bg3`                                               |`--stratgos-surface-2`        |
|`--text`                                              |`--stratgos-ink-900`          |
|`--text2`                                             |`--stratgos-ink-500`          |
|`--text3`                                             |`--stratgos-ink-300`          |
|`--border`                                            |`--stratgos-ink-100`          |
|`--border2`                                           |`--stratgos-ink-200`          |
|`--red`                                               |`--status-late`               |
|`--amber`                                             |`--status-risk`               |
|`--green`                                             |`--status-ontrack`            |
|`--blue`                                              |`--status-done`               |
|`--red-bg` / `--green-bg` / `--amber-bg` / `--blue-bg`|corresponding tints           |
|`--stratgos-moss`                                     |`--status-ontrack`            |
|`--stratgos-parchment`                                |`--stratgos-bg`               |
|`--stratgos-cream`                                    |`--stratgos-surface`          |
|`--stratgos-ember-dark`                               |`--stratgos-ember-hover`      |

### Typography — four faces, one voice

Four typefaces total. Never a fifth.

|Token           |Font            |Role                                                                     |Notes                                                             |
|----------------|----------------|-------------------------------------------------------------------------|------------------------------------------------------------------|
|`--font-display`|Instrument Serif|Wordmark, hero, section titles, pull quotes                              |Regular only — never bold                                         |
|`--font-serif`  |Fraunces        |Editorial body for brand documents, executive reports, PDS narrative text|Regular + Medium. **Not used in product UI**                      |
|`--font-sans`   |Inter           |Product UI: dashboards, tables, forms                                    |12–15px. Regular / Medium / Semibold. Never italic in UI          |
|`--font-mono`   |JetBrains Mono  |Labels, kickers, metadata, IDs, timestamps                               |10–13px. Always tracked (letter-spacing 0.12–0.2em) when uppercase|

### Type scale (utility classes in `src/styles/typography.css`)

|Class          |Size / line-height|Font / weight                   |
|---------------|------------------|--------------------------------|
|`.t-display-xl`|88 / 0.95         |Instrument Serif                |
|`.t-display`   |48 / 1.0          |Instrument Serif                |
|`.t-headline`  |32 / 1.1          |Fraunces                        |
|`.t-title`     |20 / 1.3          |Inter 600                       |
|`.t-body-l`    |18 / 1.5          |Fraunces (editorial only)       |
|`.t-body`      |15 / 1.55         |Inter 400                       |
|`.t-label`     |11 / 1.4          |JetBrains Mono uppercase tracked|

### Iconography

Lucide / Feather only. Stroke-based, 1.5px, rounded caps and joins. Optically aligned to a 24×24 grid. Monochrome (ink-900 or surface). Ember accent only for active/selected states. Never filled, never multi-colour, never gradients, never mixed icon libraries. **No emojis in `.tsx`/`.ts`** — verified clean.

### Voice — two registers

**Full Stratgos voice** (direct, opinionated, dry) — marketing site, landing pages, board-facing reports, sales decks, brand documents.

**Neutral functional voice** (transactional, no personality) — product UI labels, buttons, empty states, system messages, errors, email notifications. Reason: in cobrand deployments the customer’s logo sits next to ours; product UI is shared infrastructure, not marketing.

Four principles (apply to both registers):

1. Numbers first — lead with the specific fact, then interpretation
1. No exclamation marks — boards don’t shout
1. Portuguese-first (European Portuguese, neutral register) for UI strings
1. Dry over witty — never witty in transactional UI

### Cobranding modes

Governed by `app_config.branding_mode` (JSONB string):

- `stratgos` — Stratgos-only (default for marketing, demo, single-tenant)
- `cobrand` — italic g mark + 1px divider + customer logo + customer name
- `whitelabel` — customer logo only, “powered by Stratgos” footer (premium tier, **deferred to Phase 15**)

The ink-900 topbar is shared infrastructure. Never customizable to client colors. Logo goes ON it, not behind it.

### Authority

This section is source of truth for brand. When a request conflicts (e.g. “make topbar blue”, “use red for status”), flag the conflict and ask before proceeding.

-----

## Project Structure

```
src/
├── components/
│   ├── Badge/ Brand/ Breadcrumb/ Card/ CommandPalette/ ConfirmModal/
│   ├── DateRangePicker/ DuplicatePlanoModal/ EditUserModal/ EmptyState/
│   ├── FilterBar/ ForgotPasswordModal/ InteractiveRiskMatrix/ InviteUserModal/
│   ├── ItemDetailModal/ Kpi/ KpiCard/ Layout/ Modal/ MultiPersonSelect/
│   ├── MultiSelect/ NovoPlanoModal/ PageHeader/ ProgressBar/ RiskMatrix/
│   ├── SearchableSelect/ Spinner/ SplashScreen/ Table/ TermTooltip/ Toast/
│   └── UserPermissionsForm/
├── context/
│   ├── AuthContext.tsx · BrandingContext.tsx · FilterContext.tsx
│   ├── ProfileContext.tsx · ToastContext.tsx
├── pages/
│   ├── Actividades/ Admin/ BudgetPage/ Dashboard/ Evolucao/
│   ├── ExecucaoFinanceira/ Gantt/ GestaoFinanceira/ Glossary/
│   ├── Login/ NotFound/ PlanoPage/ PlanosCatalog/ PontoSituacao/
│   ├── Profile/ Recursos/ ResetPassword/ SetupPassword/
├── hooks/
│   ├── useAccessiblePrograms.ts · useActivities.ts · useActivityDependencies.ts
│   ├── useAuth.ts · useCanEditCurrent.ts · useEixos.ts · useFilter.ts
│   ├── useFinancials.ts · usePdsEntries.ts · usePeople.ts · usePermissions.ts
│   ├── usePlanos.ts · usePrograms.ts · useProgramLabels.ts · useResources.ts
│   ├── useRisks.ts · useRole.ts · useSnapshots.ts
├── lib/
│   ├── activityDependencies.ts · edgeFunctionError.ts · healthRules.ts
│   ├── invoiceHelpers.ts · markdown.tsx · riskColors.ts · rollup.ts
│   ├── supabase.ts · tokens.ts
├── styles/
│   ├── tokens.css · typography.css · components/{buttons,tables}.css
├── types/index.ts
└── App.tsx · main.tsx · index.css
```

> **Note on page filenames:** PT-PT file names (Actividades, Recursos, Evolucao, PlanoPage, PlanosCatalog, GestaoFinanceira, PontoSituacao) are inherited from earlier code. The intended long-term convention is **code in English, UI strings in PT-PT**, so these are tech debt for a future rename wave (see Phase 13.9 in `TODO.md`).

Pages with embedded `gestão` (management) tabs — `PlanoPage` (plan page) now hosts all of these instead of standalone routes: GestaoIniciativas, GestaoPDS, GestaoRiscos, GestaoRecursos, GestaoFinanceira. Standalone routes were sunset in Waves 5a/5b/5c/6.

-----

## Custom Hooks

|Hook                                                                                         |Purpose                                                                                                                                                                                     |
|---------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|`useAuth()`                                                                                  |Auth state + login/logout                                                                                                                                                                   |
|`useRole()`                                                                                  |Returns role string                                                                                                                                                                         |
|`usePermissions()`                                                                           |`hasAccess(page, programId?, planId?)`, `canEdit(page, programId?, planId?)`. Deny-by-default. Resolves plan-specific row first, falls back to program-wide. `stakeholder` always read-only.|
|`useAccessiblePrograms(page?)`                                                               |Programs where user has access to the page (admin short-circuit returns all)                                                                                                                |
|`useAccessiblePlanIds(page, programIds)`                                                     |Plans where user has access within given programs                                                                                                                                           |
|`useCanEditCurrent(page)`                                                                    |Derived from FilterContext; true only if user can edit in ALL selected programs/plans                                                                                                       |
|`usePrograms()`, `useEixos(programId?)`, `usePlanos(programId?)`, `useActivities(programId?)`|Hierarchy data: programs / eixos (axes) / planos (action plans) / activities                                                                                                                |
|`useActivityDependencies()`                                                                  |CRUD + `getPredecessors` / `getSuccessors`. `updateDependency` typed to `dep_type | lag_days` only                                                                                          |
|`useFinancials()`, `useResources()`, `useRisks()`, `usePdsEntries()`                         |Domain data                                                                                                                                                                                 |
|`usePeople()`                                                                                |Global catalog (no filtering; callers handle active filter)                                                                                                                                 |
|`useFilter()`                                                                                |`{ filters, setFilter, clearAll }`. `filters.{programIds, n1Values, n2Values, statuses, owners, sponsors}[]`                                                                                |
|`useProgramLabels(programId)`                                                                |Dynamic filter labels per program; module-level cache (one fetch per program per session)                                                                                                   |
|`useSnapshots()`                                                                             |KPI snapshots for `Evolução` (Evolution page)                                                                                                                                               |

-----

## Shared Libraries

### `src/lib/rollup.ts`

Threshold-driven status and percentage rollup engine. **3-zone band threshold model** (Wave 3, May 2026) producing a **4-state status**.

**Status type:** `RowState = 'Concluída' | 'Em dia' | 'Em risco' | 'Em atraso'`.

**`ThresholdBand`** is a pair `{ low, high }` (values in percentage points, pp) that defines the **width of the `"Em risco"` (at risk) middle zone**. Given a delay `delta = pct_target - pct_actual`:

- `delta <= band.low` → `"Em dia"` (on track)
- `band.low < delta <= band.high` → `"Em risco"` (at risk)
- `delta > band.high` → `"Em atraso"` (late)

Two independent bands are loaded from `app_config` at startup (via `setThresholds(aggregates, leaves)`), one for aggregates and one for leaves. Leaves use tighter defaults because a single late leaf is a stronger signal than a small dip in an average.

**Default bands:**

|Band      |`low`|`high`|Used for                                                         |
|----------|-----|------|-----------------------------------------------------------------|
|Aggregates|15 pp|25 pp |N0-N3 levels (`Programa` / `Eixo` / `Plano` / `Macro-actividade`)|
|Leaves    |5 pp |10 pp |N4-N6 levels (`Actividade` / `Sub-actividade` / `Detalhe`)       |

Since Wave 6 Path A (May 2026, migration 038), the deprecated single-value threshold columns (`programs.threshold_aggregates`, `programs.threshold_leaves`, `planos.threshold_aggregates`, `planos.threshold_leaves`) have been dropped. The legacy `app_config` keys `status_delay_threshold`, `status_delay_threshold_aggregates`, `status_delay_threshold_leaves` were also deleted. The model is now fully band-based across all layers: read, write, persist, UI, and DB.

**Exports:** `setThresholds(aggregates, leaves)`, `getThresholdAggregates()`, `getThresholdLeaves()`, `leafPctPrev(activity, today)`, `leafStatus(activity, today, band?)`, `rollupPct(leaves)`, `rollupPctPrev(leaves, today)`, `rollupStatus(leaves, today, band?)`, `computeRowState(actual, target, band?)`, `rollupDateRange(activities)`, `rollupRealDateRange(activities)`, `getN4DescendantLeaves(n4, all)`, `getN4Effective(n4, all)`.

**`leafPctPrev(activity, today)`** — date-based expected % for a single activity (0-100). Linear interpolation between `bs` (baseline start) and `bf` (baseline finish). `today <= bs` → 0, `today >= bf` → 100, else linear. Falls back to stored `pct_prev` when baseline dates are missing.

**`leafStatus(activity, today, band = THRESHOLD_LEAVES)`** — 4-state status for a single leaf (level 4-6). Resolution order (first match wins):

1. `pct >= 100` → `"Concluída"`
1. `today > bf AND pct < 100` → `"Em atraso"` (deadline missed)
1. Compute `delta = leafPctPrev(today) - pct`; apply 3-zone bands → `"Em dia"` / `"Em risco"` / `"Em atraso"`

**`rollupStatus(leaves, today, band = THRESHOLD_AGGREGATES)`** — 4-state status for an aggregate (N0-N3), computed from its N4 leaves. Resolution order:

1. `leaves.length === 0` → `"Em dia"`
1. All `pct >= 100` → `"Concluída"`
1. `today > max(bf of leaves) AND avg pct < 100` → `"Em atraso"` (group deadline missed)
1. Compute `delta = avg pct_prevista - avg pct`; apply 3-zone bands → `"Em dia"` / `"Em risco"` / `"Em atraso"`

**`computeRowState(actual, target, band)`** — 4-state status from already-computed percentages. Does NOT consider deadlines. Prefer `rollupStatus` when the caller has access to leaves (handles date-based overrides correctly).

**KPI rule:** all KPI aggregations use `level === 4` only. N5/N6 are detail records and NEVER included.

**N4 effective values** — `getN4Effective(n4, all)` returns `{ bs, bf, rs, rf, pct }` for an N4: if it has N5/N6 descendants (matched by shared `n1`/`n2`/`n3` + `n4 === parent.name`), values are rolled up from descendants; otherwise the N4’s own DB values are used.

### `src/lib/riskColors.ts`

Shared 5-level risk severity gradient.

**Exports:** `gradeStyle(grade, size, thresholds?)`, `gradeLabel(grade, size, thresholds?)`, `DEFAULT_THRESHOLDS`, types `RiskThresholds`, `GradeStyle`.

|Level (PT-PT)  |English |Color       |Hex      |
|---------------|--------|------------|---------|
|`"Muito Baixo"`|Very low|dark green  |`#4a9e3f`|
|`"Baixo"`      |Low     |yellow-green|`#8cc63f`|
|`"Médio"`      |Medium  |yellow/amber|`#f5c542`|
|`"Alto"`       |High    |orange      |`#f5943a`|
|`"Crítico"`    |Critical|soft red    |`#e85c4a`|

### `src/lib/healthRules.ts`

Configurable health evaluation engine for the PDS semaphore (PDS = `Ponto de Situação` / status report).

**Exports:** `computeHealth(input, config)`, `DEFAULT_HEALTH_CONFIG`, `HEALTH_METRIC_LABELS`.

**Metrics:** `exec_delay`, `delayed_pct`, `critical_risks`, `high_risks`, `attention_open`. Each rule has `enabled` flag and `threshold`. Block operator is OR or AND. Each color (red, amber) has independent block config.

### `src/lib/invoiceHelpers.ts`

**Exports:** `invoiceStatusStyle(status)`, `invoiceTermPct(issue_date, due_date)`, `invoiceAlert(invoice, thresholds)`.

**5 canonical invoice states** (PT-PT, stored as UI labels, DB CHECK enforces):

|Status (PT-PT)|English |Color|
|--------------|--------|-----|
|`"Prevista"`  |Forecast|grey |
|`"Recebida"`  |Received|blue |
|`"Aprovada"`  |Approved|amber|
|`"Paga"`      |Paid    |green|
|`"Rejeitada"` |Rejected|red  |

**Alert logic:** only unpaid (not `"Paga"`, not `"Rejeitada"`) invoices with both `issue_date` and `due_date` are classified. Uses `(today - issue) / (due - issue) × 100`.

### `src/lib/activityDependencies.ts`

Dependency graph validation and date propagation.

**Exports:** `wouldCreateCycle(predId, sucId, existingDeps)`, `validateDependencyDates(pred, suc, depType, lag)`, `propagateDateChanges(changed, all, allDeps)` returning `Map<id, {bs, bf}>`, `canHaveDependencies(activity)` (level >= 4), `validateNewDependency(...)`, `computeDepGap(pred, suc, depType, lag)`.

**Dependency types:** FS (Finish-Start), SS (Start-Start), FF (Finish-Finish), SF (Start-Finish). `lag_days` integer.

**Error codes (priority order):** SELF_DEPENDENCY → NON_LEAF → DUPLICATE → CYCLE → DATE_VIOLATION.

### `src/lib/tokens.ts`

JS/TS source of truth for brand colors (mirrors CSS `:root` variables). Used by Recharts and inline JSX styles.

**Exports:** `colors.brand.*`, `colors.status.*`, `colors.neutral.*`, `statusColor(key)`, `chartPalette`, `chartDefaults`, `riskGradeColors`.

**Rule:** charts NEVER hardcode hex values. Always import from `tokens.ts`.

### `src/lib/edgeFunctionError.ts`

`extractEdgeFunctionError(error)` reads `FunctionsHttpError.context.json()` to surface specific error messages from Edge Function 4xx/5xx responses. See **Known Issues — FunctionsHttpError gotcha** below.

### `src/lib/markdown.tsx`

Markdown rendering for PDS narrative text.

### `src/lib/owners.ts`

Centralized resolution helpers for plano owner/sponsor display (Phase 13.12 prerequisite, May 2026). Since migration 040 (May 26 2026), `planos.owner` and `planos.sponsor` are no longer string columns — they're FK arrays + primary FK + optional label override. These helpers encapsulate the resolution logic so every UI surface that displays or computes an owner/sponsor goes through the same code path.

**Exports:**

- `resolveOwnerNames(plano, peopleMap): string[]` — array of display names. Priority: FK lookup via `owner_person_ids[]`, then `owner_label_override` (non-person entity like "Comissão Executiva", "DCH"), else empty.
- `resolveSponsorNames(plano, peopleMap): string[]` — same logic for sponsor.
- `resolveOwnerPrimaryEmail(plano, peopleMap): string | null` — resolves `owner_primary_id` to the person's email (used by the Owner Update Form to determine where to send the update-request email).
- `formatPeopleList(names, separator = ' · '): string` — join names with middle-dot separator (used in tables, lists, breadcrumb chips).

Callers must pass a `peopleMap: Map<string, Person>` built once via `useMemo(() => new Map(people.map(p => [p.id, p])), [people])` to avoid O(n) lookups per row.

### `src/lib/sort.ts`

Hierarchical natural sort helpers introduced in Wave 4 (May 2026).

**Exports:** `compareCodes(a, b)`, `comparePlanos(a, b)`, `compareEixos(a, b)`.

**Use cases:**

- `FilterBar`: dropdown options for `Eixo` / `Plano`.
- `PlanosCatalog`: default plano list ordering.
- `Admin.tsx`: programs / eixos / planos in the hierarchy table.

**For `useActivities` consumers (`Actividades`, `Gantt`):** these pages do a client-side hierarchical sort using maps from `usePrograms` + `useEixos` + `usePlanos` to resolve the `program → eixo → plano → level → sort_order` chain. The `useActivities` hook intentionally stays simple (only orders by `sort_order ASC` from the DB) — each consumer is responsible for its own multi-level ordering when needed.

### `src/lib/glossary.ts`

Canonical product vocabulary as structured data. 13 sections × ~62 terms total, each with `id` slug for deep-linking. Helper exports: `findGlossaryTerm(id)`, `findGlossarySection(id)`, `getActivityStateTermId(state)`, `getPdsStateTermId(state)`. Consumed by the `/glossary` standalone page and by the `TermTooltip` component.

### `src/lib/supabase.ts`

Supabase client setup.

-----

## Reusable Components (highlights)

### Forms & Pickers

- **`NovoPlanoModal`** (new-plan modal) — 2-step `Plano` (action plan) wizard (Step 1 form, Step 2 optional Excel import). Shared by `PlanosCatalog`, embedded `GestaoIniciativas`, and the Admin Programas/Eixos/Planos tree. Used in both create + edit modes. Optional props `defaultEixoId` (pre-select parent eixo in create mode) and `contextLabel` (e.g. `"em <programa> › <eixo>"` for contextual modal title). Threshold pair inputs ordered Agregados-first for consistency with the Admin Definições tab.
  - **Owner/Sponsor (since Phase 13.12, May 26 2026):** uses `MultiPersonSelect` returning `string[]` of person names. At save time, names resolve to UUIDs via `peopleByName` map; unmatched fragments (typically org units like `DCH`/`GGE`) are captured into `owner_label_override` / `sponsor_label_override` (joined by ` | `), preserving user intent. User-typed label override input ("Ou nome de entidade (raro)") takes precedence — auto-captured fragments are appended after it. Persists to FK fields only (`owner_person_ids[]` + `owner_primary_id` + `owner_label_override`, same for sponsor).
- **`DuplicatePlanoModal`** — deep-copy with hybrid time-shift (offset by `chosenDate - earliestSourceBs`). `activity_dependencies` remapped via `oldId → newId`. Not cloned: risks, recursos (resources), PDS, fin_*.
- **`SearchableSelect`** — typeahead with `position: fixed` dropdown (escapes parent `overflow: clip`), `min-width: 280px`, closes on scroll/resize.
- **`MultiPersonSelect`** — Linear/Notion style single input. Sources: active people + unique `org_units` from `people.org_unit`. Storage: text joined with `' | '` (no schema change). Backward compatible with legacy single-value entries.
- **`AdminProgramModal`** (May 2026) — create + edit programs from the Admin tree. Fields: Code, Name, 4 threshold inputs (Agregados Low/High first, Actividades Low/High second). Validation: `low ≥ 0`, `≤ 100`, `high ≥ low`. Defaults for new program: leaves `{ 5, 10 }`, aggregates `{ 15, 25 }`. Max-width 560px, ESC / backdrop / Cancel all close.
- **`AdminEixoModal`** (May 2026) — create + edit eixos. Fields: Code, Name (eixos have no thresholds — inherit from parent programa). Contextual title `"Novo Eixo · em <programa>"` / `"Editar Eixo · em <programa>"`. Same modal infrastructure as AdminProgramModal.
- **`InviteUserModal`** — email + role + name + permissions form. Calls `invite-user` Edge Function.
- **`EditUserModal`** — 3 editable fields (name, email, role). Email change shows secondary `ConfirmModal`. Role downgrade (edit-capable → view-only with stranded edit permissions) shows `ConfirmModal`.
- **`UserPermissionsForm`** — controlled reusable form. Vertical `"Acesso por página"` (per-page access) list (12 rows) + `"Restrições por plano"` (per-plan restrictions) picker.
- **`ConfirmModal`** — replaces `window.confirm` for destructive actions. `destructive` prop switches `btn-primary` → `btn-danger`.
- **`ForgotPasswordModal`** — triggers `auth.resetPasswordForEmail()`.

### Display

- **`Breadcrumb`** — persistent filter UI below topbar (hidden on `/admin`). 3 parallel dropdowns always visible: `Programa · Eixo · Plano` (Program · Axis · Plan). Plus chips for secondary filters (Status, Owner, Sponsor) + `"+ Filtros"` (+ Filters) button → popup with checkboxes. **Single source of truth for filter UI**; topbar has NO filter icon.
  - Cascade: parent selected → children restricted. Auto-fill: child selected → parents auto-fill silently. Cross-navigation supported. Options bounded by `accessibleProgramIds` for current page. `trySetProgram()` guards programmatic selection. `sessionStorage` persistence (resets on new tab).
  - FilterContext API: `filters.programIds[0]`, `n1Values[0]`, `n2Values[0]`, `setFilter(key, value)`.
- **`DateRangePicker`** — trigger + popup with 2 native date inputs + shortcuts (`"Este mês"` / `"Trimestre"` / `"Este ano"` = This month / Quarter / This year). Cancel behaviour (only `"Aplicar"` (Apply) fires `onChange`).
- **`EmptyState`** — 7 icon variants (data / list / target / inbox / chart / calendar / folder). Applied to 12 pages.
- **`SplashScreen`** — logo with pulse animation, 300ms fade-out. No minimum-visibility timer (light bg variant). Used at app boot.
- **`DeviationBar`** (inline in `Dashboard`) — mini progress bar with target marker. Moss fill at 0.8 opacity when on-target, Crimson when off-target.
- **`TermTooltip`** — glossary-driven contextual tooltip. 500ms delay, dark background, auto placement, hover-bridge (cursor entering the tooltip does not dismiss it), deep-link `"Ver glossário →"` (see glossary) to the relevant section/term. Used via `tooltipTerm` prop on `KpiCard` / `SmartKpi` and inline `<TermTooltip termId="...">` for ad-hoc cases. Graceful degradation when `termId` is unknown (renders children without tooltip).
- **`CommandPalette`** — Cmd+K command bar (Linear-style). Currently scoped to plano search only; expansion planned in Phase 13.7.
- **`KpiCard`** — with `variant="hero"` for large KPI rows (`Actividades`, `Evolução`, `GestaoFinanceira`, `BudgetPage`).

### Brand

- **`StratgosWordmark`**, **`StratgosGMark`** — `<img>` wrappers with size + variant props. Use PNG assets in `public/`.

-----

## Contexts

|Context          |Role                                                                                                                                                              |
|-----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|`AuthContext`    |Authentication state, login/logout/session                                                                                                                        |
|`FilterContext`  |Filters across all pages (programIds, n1Values, n2Values, statuses, owners, sponsors). Since Phase 13.12 commit 3 (May 26 2026), `owners` and `sponsors` filter state keys hold UUIDs (not name strings); options derived from `owner_person_ids[]` via `peopleMap` lookup. URL filter format changed accordingly — bookmarked URLs with the old name-based format silently lose the filter. Exports `personIdToName` map for downstream UUID→name resolution. Session storage version bumped to v2. Org units (`DCH`, `GGE`) no longer filterable — they live in `owner_label_override` only.|
|`ToastContext`   |Global toast notifications                                                                                                                                        |
|`BrandingContext`|Brand identity from `app_config.branding_mode` + `client_logo_url` + `client_title`/`client_subtitle`. `refresh()` for live updates after Admin save.             |
|`ProfileContext` |User profile (`full_name`, avatar). Subscribes to `auth.onAuthStateChange`: clears on `SIGNED_OUT`, refetches on `SIGNED_IN` / `TOKEN_REFRESHED` / `USER_UPDATED`.|

-----

## Database Schema

> Hierarchical domain language: **`Programa`** (program, N0) → **`Eixo`** (axis / track, N1) → **`Plano`** (action plan, N2) → **`Macro-actividade`** (macro-activity, N3) → **`Actividade`** (activity, N4) → **`Sub-actividade`** (sub-activity, N5) → **`Detalhe`** (detail, N6).

### Core hierarchy (dedicated tables)

- **`programs`** — N0 level. Top of the hierarchy (`Programa`). id, code, name, sort_order, threshold_aggregates_low, threshold_aggregates_high, threshold_leaves_low, threshold_leaves_high
- **`eixos`** — N1 level (`Eixo` / axis-track). id, program_id → programs (RESTRICT), code, name, sort_order
- **`planos`** — N2 level (`Plano de Acção` / action plan). id, eixo_id → eixos (RESTRICT), program_id, code, name, sort_order, start_date, end_date, objective, threshold_aggregates_low, threshold_aggregates_high, threshold_leaves_low, threshold_leaves_high, owner_person_ids, owner_primary_id, owner_label_override, sponsor_person_ids, sponsor_primary_id, sponsor_label_override
  - **Owner/Sponsor (since migration 040, May 26 2026):** structured FK columns replace the legacy `owner` / `sponsor` strings (dropped).
    - `owner_person_ids uuid[] NOT NULL DEFAULT '{}'` — UUIDs of people who own this plano (multi-value)
    - `owner_primary_id uuid REFERENCES people(id) ON DELETE SET NULL` — primary owner; receives Owner Update Form emails
    - `owner_label_override text` — fallback for non-person owners (e.g. "Comissão Executiva", "DCH") when no `people` row exists
    - Same triplet for sponsor (`sponsor_person_ids`, `sponsor_primary_id`, `sponsor_label_override`)
    - Resolution centralized in `src/lib/owners.ts` (`resolveOwnerNames` / `resolveSponsorNames`)
  - `start_date` / `end_date` kept but no longer written by frontend (rollup-only model since Wave 4.1)
  - `threshold_*` columns are nullable; when null, the plano inherits from the parent programa (resolution chain in `rollup.ts`)
- **`activities`** — N3-N6 levels (`Macro-actividade` / `Actividade` / `Sub-actividade` / `Detalhe`). id, level (0-6), name, n0-n6 text, program_id, eixo_id, plano_id → planos (CASCADE)
  - `pct`, `pct_prev`: stored as 0-100 (**NOT 0-1**) — do NOT multiply by 100
  - `status`: `"Em dia" | "Em atraso" | "Concluída"`
  - `bs`, `bf`, `rs`, `rf`: baseline/real start/finish dates (ISO strings)
  - `source`: CHECK (`act`, `gantt`, `manual`), DEFAULT `manual`, nullable
  - Trigger `sync_plano_id()` auto-populates `plano_id` from n2 name on INSERT/UPDATE
  - **Legacy columns dropped (Wave 8d):** `owner`, `sponsor`

### Activity Dependencies

- **`activity_dependencies`** — id, successor_id → activities (CASCADE), predecessor_id → activities (CASCADE), dep_type CHECK IN (`FS`, `SS`, `FF`, `SF`), lag_days integer DEFAULT 0
  - UNIQUE (successor_id, predecessor_id)
  - CHECK (successor_id != predecessor_id)
  - Indices on both FKs
  - RLS: admin / editor write, all authenticated read
  - Only leaves (level >= 4) can have dependencies (enforced in lib)

### Financial

- **`fin_budget_lines`** — program_id, plano_id (CASCADE), category, capex, values JSONB
- **`fin_contracts`** — program_id, plano_id (CASCADE), supplier, amount, currency, exchange_rate, end_date
- **`fin_invoices`** — program_id, plano_id (CASCADE), contract_id → fin_contracts, ref, amount, issue_date, due_date, payment_date, status
  - **CHECK:** status IN (`"Prevista"`, `"Recebida"`, `"Aprovada"`, `"Paga"`, `"Rejeitada"`)
- **`cost_categories`** — name, is_capex (program association via `cost_category_programs`)
- **`cost_category_programs`** — category_id → cost_categories (CASCADE), program_id → programs (CASCADE)
- **`currencies`** — code (EUR / USD / AKZ), name, symbol, is_default
- **`management_years`** — per program, year

### PDS & Risks

- **`pds_entries`** — `Ponto de Situação` (status report) entries. program_id, plano_id (CASCADE), n0, n1, plan_name, 4 JSONB arrays (commitments / progress / next_steps / attention)
- **`risks`** — program_id, plano_id (CASCADE), description, impact, probability, status, mitigation

### Resources & People

- **`fte_resources`** — program_id, plano_id (CASCADE), name, type, allocation_pct, dates, daily_cost, person_id → people (SET NULL)
- **`people`** — id, name, email, company (renamed from `type` in Wave 8a), is_external BOOLEAN, profile_id → profiles (SET NULL), org_unit, role, active, cost_role_id, cost_per_hour_override, currency
  - `profile_id` editable in Admin/Pessoas (people tab) via `SearchableSelect` with auto-fill email

### Auth & Config

- **`profiles`** — id, email, full_name, role (admin / program_manager / project_manager / sponsor / stakeholder)
- **`user_permissions`** — user_id, program_id, plan_id → planos (CASCADE), page, access_level
  - `plan_id IS NULL` = “all plans of program” (program-wide row, default)
  - `plan_id IS NOT NULL` = plan-level override (can only RESTRICT, never expand)
  - **Migration 033:** `log_change` trigger attached for audit trail
  - **Migration 034:** partial unique indices (`user_permissions_program_level_uniq` WHERE plan_id IS NULL, `user_permissions_plan_level_uniq` WHERE plan_id IS NOT NULL) allow co-existence
  - Resolution (frontend): plan-specific row first, fallback to program-wide
- **`app_config`** — config_key, data (JSONB), updated_at, updated_by
- **`change_log`** — audit table populated by `log_change()` trigger on 12 tables. Uses `auth.uid()` for `changed_by` (Migration 029 fix).
- **`snapshots`** — daily KPI snapshots (kpi, by_n0, by_n1, by_n2 JSONB), `daily_snapshot()` cron at 23:59. UUID keys. Counts only `level=4`. Includes `conc_a_data_denom`.
- **`activities_history`** — activity_id (SET NULL on delete), preserves history

### Key constraints

- `eixos`: RESTRICT (can’t delete with child planos)
- `planos`: RESTRICT from eixos; CASCADE to all child tables
- `activities_history`: SET NULL (preserves history)
- `fin_invoices`: status CHECK constraint
- `activity_dependencies`: CASCADE on both FKs, UNIQUE pair, no self-reference

### Migrations naming

Files in `supabase/migrations/NNN_description.sql` (NNN zero-padded). Apply manually via Supabase SQL Editor. Lives only in `_Dev` repo. Latest applied: **040** (drop legacy `planos.owner` and `planos.sponsor` string columns — Phase 13.12 Owner refactor, May 26 2026). Recent: 039 added 6 FK columns to `planos` (`owner_person_ids[]` + `owner_primary_id` + `owner_label_override`, same triplet for sponsor) and auto-populated from legacy strings; 038 dropped deprecated single-value threshold columns + 3 legacy app_config keys (Wave 6 Path A, May 2026); 037 introduced per-parent canonical `sort_order` for programs / eixos / planos / activities via `ROW_NUMBER() PARTITION BY parent`.

-----

## Edge Functions

Privileged operations on `auth.users` (which anon client cannot perform) are routed through Edge Functions. Each function performs admin-role validation via the caller’s JWT, then uses `service_role` internally.

|Function              |Source                                            |Purpose                                                                |
|----------------------|--------------------------------------------------|-----------------------------------------------------------------------|
|`invite-user`         |`supabase/functions/invite-user/index.ts`         |`inviteUserByEmail` + insert profile + insert user_permissions (atomic)|
|`delete-user`         |`supabase/functions/delete-user/index.ts`         |Delete user_permissions + profile + auth.users (cascade)               |
|`force-reset-password`|`supabase/functions/force-reset-password/index.ts`|`generateLink({ type: 'recovery' })` + send recovery email             |
|`update-user-email`   |`supabase/functions/update-user-email/index.ts`   |Update auth.users email + sync `profiles.email` + sync `people.email`  |

**Deploy workflow:** code versioned in `_Dev` repo. Actual deploy is via Supabase Dashboard copy-paste because user’s Mac runs **macOS 11 Big Sur** which lacks the Supabase CLI requirement of macOS 12+.

**CORS:** all functions allow `authorization, content-type, apikey, x-client-info` in `Access-Control-Allow-Headers`. Missing them breaks preflight.

**Error handling:** functions return `{ error: string }` body with HTTP 4xx/5xx. Frontend uses `extractEdgeFunctionError` helper.

-----

## `app_config` keys

### UI & global

- `client_title`, `client_subtitle`, `client_logo_url`, `cutoff_date`
- `branding_mode` (JSONB string: `'stratgos' | 'cobrand'`)
- `filter_labels_{programId}` (JSONB: `{ n0?, n1?, n2?, owner?, sponsor? }`). Defaults (PT-PT): `Programa` / `Eixo` / `Plano de Acção` / `Responsável` / `Patrocinador`.

### Rollup thresholds (3-zone band model)

- `status_delay_threshold_aggregates_low` (numeric, default 15) — lower bound of `"Em risco"` band for N0-N3
- `status_delay_threshold_aggregates_high` (numeric, default 25) — upper bound of `"Em risco"` band for N0-N3 (delta > high → `"Em atraso"`)
- `status_delay_threshold_leaves_low` (numeric, default 5) — lower bound of `"Em risco"` band for N4-N6
- `status_delay_threshold_leaves_high` (numeric, default 10) — upper bound of `"Em risco"` band for N4-N6
- Loaded at startup in `Layout.tsx` via `setThresholds(aggregates, leaves)`
- **Legacy keys dropped (Wave 6 Path A, migration 038):** `status_delay_threshold`, `status_delay_threshold_aggregates` (JSONB), `status_delay_threshold_leaves` (JSONB)

### PDS (`Ponto de Situação` — status reports)

- `pds_hide_completed_days` (integer, default 90) — hide completed commitments older than X days
- `health_rules` (JSONB: `HealthConfig` with red/amber blocks, OR/AND operators)

### Risks

- `risk_matrix_size` (`'3' | '4' | '5' | '6'`)
- `risk_thresholds` (JSONB: `{very_low, low, medium, high}`)
- `risk_states` (JSON array of strings)

### Invoices

- `invoice_alert_overdue` (integer, default 100) — % of due term to classify as overdue
- `invoice_alert_due_soon` (integer, default 85) — % of due term to classify as due soon

### Resources

- `resource_profiles` (JSON array of strings: PM, Developer, Analista, etc.)
- `org_units` (JSON array of strings: TI, Negócio, etc.)

-----

## Permissions System (frontend + RLS)

### Roles & matrix

Per-user × per-program × per-page (`user_permissions`). Plan-level rows can RESTRICT (never expand). Page keys: `dashboard`, `actividades`, `gantt`, `ponto-situacao`, `exec-financeira`, `recursos`, `evolucao`, `gestao-iniciativas`, `gestao-pds`, `gestao-riscos`, `gestao-financeira`, `gestao-recursos`.

### DB enforcement (RLS)

**Helper functions:**

- `user_has_program_access(program_id)` — any row for program OR admin
- `user_can_edit_program_page(program_id, page)` — row with `access_level='edit'` OR admin

**Scoped tables (7 with program_id):** activities, eixos, planos, pds_entries, risks, fin_budget_lines, fin_invoices.

- SELECT policy: `user_has_program_access`
- INSERT / UPDATE / DELETE policy: `user_can_edit_program_page` with table-specific page key:
  - activities / eixos / planos → `gestao-iniciativas`
  - pds_entries → `gestao-pds`
  - risks → `gestao-riscos`
  - fin_budget_lines / fin_invoices → `gestao-financeira`

**Admin-only writes:** programs, user_permissions, alert_rules.

### Frontend enforcement

- `usePermissions().hasAccess(page, programId?, planId?)`, `canEdit(...)` — plan-row first, fallback to program-row. Deny-by-default. Stakeholder → `canEdit` always false.
- `Breadcrumb` uses `useAccessiblePrograms(currentRoute)`.
- `Eixo` / `Plano` dropdowns bounded by `accessibleProgramIds` even when `Programa=Todos` (“All”).
- Auto-reset of `programIds` when they become inaccessible.
- Read-only badge `"· apenas leitura"` (`· read-only`) on `gestao-*` routes when user can’t edit.
- All 5 `gestão` (management) tabs hide edit/create/delete buttons + disable inputs when read-only.
- **Aggregations** (`Dashboard`, `Recursos`, `ExecucaoFinanceira`) filter raw datasets before KPI aggregation by `accessiblePlanIds`.
- **Filter silently** — no `"vista parcial"` (partial view) messages (least-privilege principle).

### Admin UI gates

- Matrix dropdown: ‘edit’ option only for editor-tier profiles
- Role downgrade (edit-capable → view-only): warns with edit-row count, converts on confirm
- Admin-role rows: edit/delete buttons disabled with tooltip `"Utilizadores Admin não podem ser editados/eliminados a partir desta interface"` (`Admin users cannot be edited/deleted from this interface`)

### Security model

Frontend-only enforcement at plan-level (Option A). RLS policies are program-level only. Multi-tenant Option B (RLS plan-level enforcement) **deferred to Phase 15**.

-----

## CSS Conventions (Tailwind v4)

- **All component/page CSS files MUST wrap rules in `@layer components { }`**
- `src/index.css` uses `@layer base { }` for design tokens
- `src/index.css` also has `@layer components { }` with global utilities: `.styled-select`, `.styled-select-sm`, `.status-pill`, `.btn-*`
- Component CSS imported in each component file: `import './Component.css'`
- Do NOT add page-specific rules to `index.css`
- Hardcoded hex/rgba colors are forbidden — always use tokens from `src/styles/tokens.css`
- Charts use `src/lib/tokens.ts` — never hardcoded hex in JSX
- Inline shadow values: use `--shadow-*` tokens
- Font-size literals: use `--text-*` tokens
- Border-radius: `var(--r)` (8px) or `var(--rl)` (12px)

**Admin.css organization:** the Admin tree (`Admin.tsx` → `AdminProgramas`) uses class prefix `.adm-tree-*` (`.adm-tree-row-prog`, `.adm-tree-row-eixo`, `.adm-tree-row-plano`, `.adm-tree-row-add-prog`, `.adm-tree-row-add-eixo`, `.adm-tree-row-add-plano`). The table uses both `.adm-panel-table` (generic admin table styles) and `.adm-tree-table` (tree-specific styles). Hierarchy is expressed only via `padding-left` on the first `<td>` of each row — no nested tables. The `.selected` class is kept on expanded program/eixo rows for future use but currently has no visual effect (chevron icon indicates expand state instead).

### Global utility classes

- `.btn` / `.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-lg` — global buttons (19 duplicate classes eliminated, 47 usages migrated)
- `.styled-select` — page-level selectors (`Programa`, `Plano`, `Ano` / Year)
- `.styled-select-sm` — compact selects inside modals and table rows
- `.status-pill` — 88px min-width pill for all status badges

### Type scale utility classes (`src/styles/typography.css`)

`.t-display-xl`, `.t-display`, `.t-headline`, `.t-title`, `.t-body-l`, `.t-body`, `.t-label`.

-----

## UI Conventions

> Code blocks below show PT-PT UI strings literally — these are real labels shown to end users.

### Toast system (never local state)

```typescript
import { useToast } from '../../context/ToastContext'
const { showToast } = useToast()

showToast('Guardado!', 'success')        // "Saved!"
showToast('Eliminado.', 'info')          // "Deleted."
showToast('Erro: ' + error.message, 'error')
showToast('Aviso importante', 'warning') // "Important notice"
```

### Modal component (never custom)

```typescript
import Modal from '../../components/Modal/Modal'

<Modal isOpen={open} onClose={() => setOpen(false)} title="Título"
  footer={<><button onClick={handleSave}>Guardar</button></>}>
  {/* form content */}
</Modal>
```

### ConfirmModal for destructive actions (never `window.confirm`)

```typescript
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal'

<ConfirmModal
  isOpen={open}
  onClose={() => setOpen(false)}
  onConfirm={handleDelete}
  title="Eliminar plano?"
  message="Esta acção é permanente."
  destructive
/>
```

Exception: `UserPermissionsForm.tsx:128` uses `window.confirm` for a sub-action inside an already-open modal (nested modal z-index/focus complications). To be migrated when nested portal solution exists.

### Collapsible sections in modals

```tsx
<Collapsible title="Dependências">
  {/* content */}
</Collapsible>
```

-----

## Glossary (canonical vocabulary v2)

Single source of truth for product vocabulary. Used to align UI strings, code identifiers (gradually), documentation, and external copy. **This glossary is authored in PT-PT by design** — it defines the canonical UI vocabulary of the product.

**13 sections** covering: `Estrutura organizacional` (organizational structure) · `Estados de Actividade` (activity states) · `Estados de PDS` (PDS states) · `Métricas de Execução` (execution metrics) · `Financeiro` (financial) · `Recursos` (resources) · `Riscos` (risks) · `Dependências` (dependencies) · `Versões / Temporais` (versions / temporal) · `Documentos` (documents) · `Roles` · `Verbos` (verbs) · `Visualizações` (visualizations).

**Deprecated terms** (PT-PT mapping):

- `"Iniciativa"` (initiative) → `"Actividade"` (activity)
- `"Pessoa"` (person) → `"Recurso"` (resource) in PMO usage
- `"Deadline"` → `"Prazo"` (deadline / due date)
- `"Execução média"` / `"Exec. real"` (average execution) → `"Grau de Execução"` (degree of execution)
- `"Desvio"` (deviation, financial) → `"Orçamento Disponível"` (available budget)
- BL / AR / RF — not introduced

Stored at `stratgos-glossario-v2.md` (artifact, not yet versioned in repo). Future: `/glossario` page in-app + contextual tooltips on key terms.

-----

## Testing & Sync Workflow

### iPad → Mac sync

```bash
# Sync from _Dev repo
cd /tmp
rm -rf temp-sync
git clone --no-checkout https://github.com/MiguelPC90/Strategos_SupaBase_Dev.git temp-sync
cd temp-sync
git checkout claude/add-collaborative-database-LWmWB

# Sync code
cp -r strategos/src ~/Strategos/strategos/
# Also sync supabase folder (lives at repo root, NOT inside strategos/)
cp -r supabase ~/Strategos/strategos/
# Sync package.json if dependencies changed
cp strategos/package.json ~/Strategos/strategos/

cd ~/Strategos/strategos
rm -rf /tmp/temp-sync

# Smoke test
npm install   # if package.json changed
npm run dev   # validate visually
```

### Sync nuance

The sync only copies `src/`, `supabase/`, `package.json`. Files at the project root that exist in both repos (`CLAUDE.md`, `TODO.md`, etc.) **diverge naturally**. Both repos can have their own version. Reconcile manually when both are updated independently.

### Production deploy (Mac → main → Cloudflare)

```bash
# Working tree clean on dev
git status

# Push dev
git push origin dev

# Merge to main
git checkout main
git merge dev
git push origin main
git checkout dev
```

Cloudflare auto-deploys `main` within 1-2 minutes.

### Smoke test convention (CRITICAL for perf/build waves)

For waves that change build configuration, lazy-loading, or bundle splitting, **always test the production build locally before pushing**:

```bash
npm run build
npm run preview   # serves dist/ on localhost:4173
```

`npm run dev` is **NOT** a substitute. Tailwind v4 + Vite have known production-build issues that don’t manifest in dev mode (see Known Issues — Tailwind v4 layer ordering).

### Before each Wave

Ask Claude Code to do `git merge main` (or equivalent rebase) at the start of the wave. Otherwise, fixes applied locally on the Mac may be silently reverted by an out-of-date `_Dev` branch.

### Pre-flight queries (DB-touching waves)

Before any wave that depends on DB state (e.g. Wave 8 Fix 12 needed to confirm `pds_entries` status values), run validation queries first. Captured in the wave’s investigation doc.

-----

## Development Conventions

### Wave model

Changes are bundled into numbered “Waves”. Each wave:

- Has a **prompt document** in `/mnt/user-data/outputs/` (or similar) that Claude Code executes
- Is tested locally before push (smoke test convention above)
- Lands in a single commit per wave (or 2-3 if technically necessary)
- Is referenced in `TODO.md` changelog under its session header
- Carries a name/scope memorable enough to discuss later (e.g. “Wave 3 — 3-zone threshold model”)

### Workflow correction (May 2026)

Previously the merge-to-main was bundled into commit instructions, pushing untested code to production (Cloudflare auto-deploys from `main`). **Corrected workflow:**

1. Commit on `dev` (or Claude Code’s branch)
1. Push
1. Sync Mac + smoke test local
1. **ONLY THEN** merge to `main`

### `git revert` vs `git reset`

- **`git revert`** when commits are already pushed and others may have pulled (preserves history, creates inverse commits)
- **`git reset --hard`** + force push only on private branches where you know no one else has pulled (e.g. `_Dev` after a failed wave that needs to be redone)

### Filenames with quotes/spaces (gotcha)

Multi-line copy-paste in terminal can accidentally create files with stray quotes/spaces in the name. Always run `git status -s` before commit to detect.

### Stale `_Dev` sync (gotcha)

`cp -r` is silent if the source doesn’t have what you expect. Before each sync, confirm last commits in `_Dev`:

```bash
git log --oneline -5   # in temp-sync directory
```

### “Keep intact” sections

In wave prompts, “keep intact” means **DO NOT touch those files/features**. Failure to respect this caused regressions historically.

-----

## Important Rules (grouped by concern)

### Data integrity

- `pct` and `pct_prev` stored as **0-100** — do NOT multiply by 100
- KPI calculations always based on `level === 4` activities only (N5/N6 are detail records)
- `Owner` / `Sponsor` (`Responsável` / `Patrocinador`) are on `planos` table, not `activities` (Wave 8d dropped legacy `activities.owner` / `sponsor`)
- Plan selectors use `usePlanos` hook (not DISTINCT from activities)
- Invoice status must be one of the 5 canonical states (DB CHECK enforces)
- Dependencies only on leaves (`level >= 4`) — `canHaveDependencies()`
- Date propagation auto on activity save via `propagateDateChanges`
- Cycles impossible — `wouldCreateCycle` blocks dep creation

### Code conventions

- Always run `npm run build` before committing — 0 errors required (CI gate active via Wave 8)
- React 19 + JSX transform — no need to `import React`
- Import directly from component files — no barrel exports
- TypeScript strict — `noUnusedLocals` does NOT exempt `_`-prefixed const in TS 6.x (delete dead code rather than mask)
- Adapt variable/property names to actual codebase API when unsure (e.g. `setFilter` not `setFilters`)
- **Code in English, UI strings in PT-PT.** New TypeScript types, functions, comments, variable names → English. UI labels, button text, error messages shown to users → PT-PT. Existing PT-PT identifiers (page filenames, etc.) are tech debt for future rename.

### CSS & design tokens

- All CSS files must use `@layer components { }`
- Brand colors in CSS → use Stratgos tokens directly (legacy aliases mapped, zero-refactoring)
- Brand colors in JS → import from `src/lib/tokens.ts`; use `statusColor()` for status-driven
- Charts never hardcoded colors — always via `tokens.ts`
- Semantic vs brand never mix — status pills use `--status-*`, brand UI uses `--stratgos-*`
- Topbar background = `--stratgos-ink-900` (NOT ink-700/800)
- Sidebar background = `--stratgos-ink-800` (legacy alias `--navy`)
- CTAs use `--stratgos-ember` (Crimson `--status-late` is now visually distinct)
- Page background = `--stratgos-bg`
- Card/modal background = `--stratgos-surface`

### UI patterns

- Use global toast system (`useToast`) — never local toast state
- Use global Modal component — never custom modal implementations
- Use `ConfirmModal` for destructive actions — never `window.confirm` (exception: nested-modal sub-action `UserPermissionsForm:128`)
- Use `.styled-select` / `.styled-select-sm` / `.status-pill` / `.btn-*` for consistency
- `Breadcrumb` is the ONLY filter UI — topbar has no filter icon; secondary filters via `"+ Filtros"` popup
- Search preserves hierarchy — matches show ancestors for context
- Splash screen mandatory on initial load (no minimum timer; current design exits as soon as auth+config+programs resolved)
- Empty states for all pages without data — use `EmptyState` component
- No emojis in `.tsx` / `.ts` — use Lucide icons

### Domain

- Activity `level` starts at 0 — `Programa`=0, `Eixo`=1, `Plano`=2, `Macro-actividade`=3, `Actividade`=4, `Sub-actividade`=5, `Detalhe`=6
- `Plano` is a standalone entity — separate table; `sync_plano_id()` trigger maintains consistency
- Use shared libs (rollup, riskColors, healthRules, invoiceHelpers, activityDependencies, tokens) — never duplicate logic
- Vocabulary: see Glossary section. Apply renames in UI strings (DB schema, routes, file names stay in legacy form for now).

### Roles & permissions

- DB role names (5): `admin`, `program_manager`, `project_manager`, `sponsor`, `stakeholder`
- UI labels are PT-PT (e.g. `"Gestor de Programa"`, `"Visualizador"`)
- `stakeholder` is read-only regardless of matrix entries
- `admin` bypasses all checks
- `usePermissions` accepts optional `planId`; resolves plan-row first, fallback to program-row

-----

## Known Issues & Gotchas

### CSS / Build

**Tailwind v4 + Vite + lazy chunks: broken layer ordering in production builds**

Discovered in Wave 7 (May 2026). When using lazy-loaded routes with code-split CSS chunks, **OR** with `cssCodeSplit: false`, the Vite + `@tailwindcss/vite` v4.2.2 toolchain serializes `@layer` blocks in an order where `@layer base` appears AFTER `@layer components`. Per CSS spec, the first occurrence of a layer name fixes its priority — so `base` (declared later in source) wins over `components`. The result: Tailwind’s universal reset `*, ::after, ::before, ::backdrop { margin: 0; padding: 0 }` wins over component rules like `.main-content { margin-left: var(--sidebar-w-col) }`.

**Admin hierarchy table visual artifacts (related to Tailwind v4 layer bug)**

The Admin "Programas, Eixos e Planos" hierarchical table (`Admin.tsx` → `AdminProgramas` component) shows occasional visual artifacts: double horizontal borders on some rows, missing border-bottom on "+ Novo X" rows, and row-height mismatches between data rows and add-rows.

A read-only audit (May 2026) confirmed:

- JSX is correct: single `<table>` with one `<tbody>`, all rows at the same level. Data rows have 3 separate `<td>` cells; "+ Novo Eixo" / "+ Novo Plano" rows use `<td colSpan={3}>`. "+ Novo Programa" lives in a `<div className="adm-panel-footer">` outside the `<table>` element.
- CSS is statically correct: `border-collapse: collapse` is active, no conflicting `border-top` / `border-bottom` rules.
- Root cause hypothesis (not confirmed): Tailwind v4 `@layer` ordering bug interfering with `border-width` in production builds (same bug that blocked Wave 7), and/or interaction with the parent `Card` component's edge borders.

**Status:** backlogged. Functionality is fine — purely cosmetic. Likely resolves when the Tailwind v4 layer ordering bug is fixed (Wave 7 standby). May be revisited as part of moving "+ Novo Programa" into the `<table>` with `colSpan={3}` for structural uniformity.

**Workarounds attempted (all failed):**

- `@layer theme, base, components, utilities;` declaration in source → minifier removes it
- Empty `@layer X {}` blocks in order → minifier removes them
- `cssCodeSplit: false` to merge into one file → still wrong order

**Impact:** Wave 7 (bundle splitting) reverted. Bundle splitting blocked until structural fix found.

**Possible future fixes:** move Tailwind reset out of `@layer base` in source; post-build script that re-injects layer order; `!important` on critical structural properties; downgrade to Tailwind v3; wait for upstream fix.

**Detection:** `npm run dev` shows correct visuals; `npm run build && npm run preview` shows broken layout. **ALWAYS smoke test with preview for build/perf waves.**

### Auth / Supabase

**`@supabase/gotrue-js` auth-token lock warnings in dev preview console**

Appears as console errors like `Lock "lock:sb-...-auth-token" was not released within 5000ms` and `Unhandled Promise Rejection: AbortError: Lock was stolen by another request`. Caused by React Strict Mode double-mount in dev/preview: auth-token is acquired twice; the second request "steals" the lock from the first. **Non-blocking, does not appear in production builds** (no Strict Mode in production). No fix planned. Distinct from the Multi-tab lock issue below (which IS reproducible in production).

**Multi-tab Supabase auth lock conflict**

Opening Stratgos in multiple browsers/tabs simultaneously with the same user causes “Lock stolen by another request” cascading failures. Workaround: close all tabs. Future fix: configure Supabase JS client `autoRefreshToken` and `multiTab` options.

**FunctionsHttpError gotcha**

When an Edge Function returns non-2xx, Supabase JS client returns `{ data: null, error: FunctionsHttpError }`. The response body is in `error.context` (a Response object), **NOT** `data.error`. Reading `data.error` returns `undefined`. Use `extractEdgeFunctionError(error)` from `src/lib/edgeFunctionError.ts`.

**Email rate limit (Supabase free tier)**

4 emails/hour. Hit during testing of invite + reset flows. Workarounds: wait 1h or generate link manually via `auth.admin.generateLink`. Long-term: configure custom SMTP (Resend, SendGrid).

**Site URL config**

Edge Function `redirectTo` is only respected if the URL is in the Redirect URLs allowed list. Otherwise Supabase falls back to Site URL. Production Site URL = `https://strategos.migcacoelho.workers.dev`. Redirect URLs include `http://localhost:5173/**` for dev.

### Platform

**macOS 11 Big Sur limitation**

User’s Mac runs macOS 11 (Big Sur). Modern Supabase CLI binaries (2.x and legacy 1.226.x) fail at runtime with `dyld: Symbol not found: _ubrk_clone` because compiled against macOS 13+ libicucore. Workarounds attempted: Homebrew limits, Docker incompatible, Dashboard schema export blocked by Free tier. **Net:** all Edge Functions deployed via Supabase Dashboard copy-paste; DEV/PROD split blocked until newer macOS access.

### React / SSR

**Gantt colgroup whitespace hydration warning**

Pre-existing, low severity. Whitespace inside `<colgroup>` triggers React hydration warning. Deferred as tech debt.

### Naming

**`stratgos.com` vs `strategos`**

Brand name is **Stratgos** (no `e`), but webapp repo + Cloudflare worker URL still use `strategos` (`strategos.migcacoelho.workers.dev`). Landing uses correct spelling (`stratgos.com`). Renaming webapp worker URL or repo deferred — see Phase 13.6 Phase B in `TODO.md`.

-----

## Claude Code Tips

- Always run `npm run build` before finishing — 0 errors required (CI gate)
- Respect existing patterns — adapt to actual API (`setFilter` not `setFilters`, etc.)
- “Keep intact” sections mean DO NOT touch those files/features
- React 19 + JSX transform — no need to `import React`
- Tailwind v4 — use CSS `@layer components` for reusable classes
- Show SQL migrations at top of response if schema changes needed
- Brand audit output — when touching colors, report what was changed
- Adapt variable/property names to match actual codebase when unsure
- Before bundling/perf waves, validate with `npm run preview` (not just `npm run dev`)
- Before DB-dependent waves, run pre-flight queries to validate assumptions
- When TS errors mention `noUnusedLocals` on `_`-prefixed const, delete dead code instead of masking (TS 6.x does not exempt `_`-prefix for const)
- Prose and identifiers in English; PT-PT only for product domain terms and UI strings

-----

## Operational notes (snapshot)

This section lists operational conventions whose origin is documented chronologically in `TODO.md`. Kept here only as “how it is today”.

- **Production HEAD (May 26 2026):** `9747b5d` on both `dev` and `main`. Bundle 1779 KB / 504 KB gzip. Cloudflare Pages auto-deploys from `main`.
- **Latest migration applied:** `040_drop_planos_owner_sponsor_strings.sql` (drops `planos.owner` and `planos.sponsor` legacy string columns; FK fields are now the source of truth).
- **Email/SMTP:** Resend via native Supabase integration; `stratgos.com` domain verified with DKIM + SPF + MX. 3000 emails/month free tier; sender `noreply@stratgos.com` (display name `Stratgos`).
- **Bloco 1 status (habilitar Owner externa):** prerequisites complete (Wave 8a ✓, owner refactor ✓, SMTP ✓). Sub-fase 1.4 — Owner Update Form MVP — is the next major work, ~28h estimated across 3 sessions.
- `supabase/migrations/` lives only in the `_Dev` repo. Sync via `cp -r supabase ~/Strategos/strategos/`.
- `TODO.md` diverges between `_Dev` and Mac — reconcile manually when both edit.
- Edge Functions deploy via Supabase Dashboard (macOS 11 Big Sur limitation).
- Cloudflare Email Routing: `hello@stratgos.com` → forward to `migcacoelho@gmail.com`.
- Formspree: `https://formspree.io/f/mdajobnr` receives landing form submissions.
