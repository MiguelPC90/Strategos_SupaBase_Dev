# CLAUDE.md — Stratgos

## Project Overview

Stratgos is a PMO (Project Management Office) dashboard for organizations managing strategic programs and projects. It provides executive summaries, activity tracking, Gantt charts, financial execution monitoring, resource management, and risk management — all in a single web application.

## Tech Stack

- **Frontend:** Vite + React 19 + Tailwind CSS v4
- **Backend/DB:** Supabase (PostgreSQL + Auth + Row Level Security)
- **Hosting:** Cloudflare Pages (auto-deploy from GitHub on push to main)
- **Package manager:** npm
- **Language:** TypeScript

## Repository

- **GitHub:** github.com/MiguelPC90/Strategos
- **Live URL:** strategos.pages.dev
- **Branch strategy:** `main` (production), `dev` (development), `feature/*` (features)

## Project Structure

Each component and page lives in its own folder with a co-located `.css` file for component-specific styles. Import directly from the component file — no index barrel files.

```
src/
├── components/
│   ├── Badge/
│   │   ├── Badge.tsx
│   │   └── Badge.css
│   ├── Card/
│   │   ├── Card.tsx
│   │   └── Card.css
│   ├── FilterBar/
│   │   ├── FilterBar.tsx
│   │   └── FilterBar.css
│   ├── KpiCard/
│   │   ├── KpiCard.tsx
│   │   └── KpiCard.css
│   ├── Layout/            # Main app shell (sidebar + topbar + content)
│   │   ├── Layout.tsx
│   │   └── Layout.css
│   ├── MultiSelect/
│   │   ├── MultiSelect.tsx
│   │   └── MultiSelect.css
│   ├── ProgressBar/
│   │   ├── ProgressBar.tsx
│   │   └── ProgressBar.css
│   └── Table/
│       ├── Table.tsx
│       └── Table.css
├── pages/
│   ├── Dashboard/
│   │   ├── Dashboard.tsx
│   │   └── Dashboard.css  # ind-section, toggle chips
│   ├── Actividades/Actividades.tsx
│   ├── Gantt/Gantt.tsx
│   ├── Evolucao/Evolucao.tsx
│   ├── PontoSituacao/PontoSituacao.tsx
│   ├── ExecucaoFinanceira/ExecucaoFinanceira.tsx
│   ├── Recursos/Recursos.tsx
│   ├── GestaoIniciativas/GestaoIniciativas.tsx
│   ├── GestaoPDS/GestaoPDS.tsx
│   ├── GestaoRiscos/GestaoRiscos.tsx
│   ├── GestaoFinanceira/GestaoFinanceira.tsx
│   ├── GestaoRecursos/GestaoRecursos.tsx
│   └── Admin/Admin.tsx
├── hooks/            # Custom React hooks (data fetching, filters)
├── context/          # React context providers (auth, filters)
├── types/
│   └── index.ts      # Shared TypeScript interfaces and types
├── lib/
│   └── supabase.ts   # Supabase client
├── App.tsx           # Router and route definitions
└── index.css         # Global tokens, reset, scrollbar, .page-placeholder
.env.local            # Supabase credentials (not in git)
vite.config.js
package.json
tsconfig.json
```

### Import pattern

```ts
// Always import directly from the component file — no index.ts barrels
import Badge from '../../components/Badge/Badge'
import Table, { type Column } from '../../components/Table/Table'
```

### CSS co-location rules

- Each component imports its own `.css` at the top: `import './Badge.css'`
- Only create a `.css` file when there are custom CSS rules (not Tailwind-only)
- `index.css` holds only: design tokens (`:root`), global reset, scrollbar, and `.page-placeholder`
- Do NOT add component-specific rules to `index.css`

## Code Conventions

### Language

- **Code** (variables, functions, components, comments): English
- **UI text** (labels, buttons, titles, messages): Portuguese (PT-PT)
- **File names:** PascalCase for components/pages (e.g. `KpiCard.tsx`), camelCase for hooks/utils (e.g. `useActividades.ts`)

### TypeScript

- All source files use `.tsx` (components/pages) or `.ts` (utilities, hooks)
- Define props interfaces for every component — no implicit `any`
- Use `type` keyword for union types (e.g. `type BadgeVariant = 'green' | 'blue'`)
- Use `interface` for object shapes (props, data structures)
- Avoid `any` — use `unknown` + type narrowing or casts where needed
- Shared types can be co-located with their component or exported for reuse
- `tsconfig.json` uses `strict: true` with `noUnusedLocals` and `noUnusedParameters`

### React Patterns

- Functional components only (no class components)
- Use hooks for state and side effects
- Props destructuring in function signature
- Default exports for pages, named exports for components when appropriate
- Keep components small — extract sub-components when a file exceeds ~150 lines

### Styling

- Use Tailwind CSS utility classes for layout and spacing
- Use CSS variables (defined in `src/index.css`) for theme colors
- Do NOT use inline style objects unless strictly necessary
- No dark mode for now (light theme only)
- No mobile responsive styles for now (desktop only)

### CSS Variables (Theme)

```css
--navy: #002E5E;
--green: #95BB42;
--bg: #fff;
--bg2: #f5f6f7;
--bg3: #eceef0;
--text: #1a1a18;
--text2: #5c5c58;
--text3: #9c9c96;
--border: rgba(0,0,0,0.09);
--border2: rgba(0,0,0,0.16);
--r: 8px;
--rl: 12px;
--blue: #185FA5;
--red: #A32D2D;
--amber: #854F0B;
```

## Reusable Components

Always use these existing components instead of creating new ones:

- **Card** — wrapper with navy accent bar on the left of the title. Props: `title`, `children`, `className`, `actions`
- **KpiCard** — single metric display. Props: `label`, `value`, `subtitle`, `color`
- **Badge** — status pill. Props: `children`, `variant` (green/blue/red/amber/grey/navy)
- **ProgressBar** — thin progress bar with percentage. Props: `value`, `color`, `showLabel`
- **MultiSelect** — dropdown with checkboxes. Props: `label`, `options`, `placeholder`
- **Table** — styled sortable table. Props: `columns` (Column[]), `rows`, `emptyMessage`. Export `Column` type for use in pages.
If a new UI pattern appears in 2+ pages, extract it as a reusable component.

## Design Rules

### Card Style

- White background, 1px solid var(–border), border-radius 12px
- Title: small vertical navy bar (3px wide) on the left, text UPPERCASE, 11px, font-weight 700, navy color, letter-spacing 0.06em

### KPI Style

- Background var(–bg2), no border, border-radius 8px, padding 0.75rem 1rem
- Label: 11px, color var(–text2)
- Value: 20px, font-weight 700, color varies by context
- Subtitle: 10px, color var(–text3)

### Sidebar

- Collapsed by default (icons only, 56px wide) — expands to 220px on hover (CSS-only, no JS)
- Icons centered when collapsed; label slides in on hover via `max-width` transition
- Navy background (#002E5E)
- Two groups: "Visualização" (view pages) and "Gestão" (management pages)
- Active state — view pages: `rgba(255,255,255,0.12)` bg, white text
- Active state — Gestão pages: `rgba(255,200,100,0.12)` bg, `#ffd070` text (amber)
- Admin link at the bottom (conditional on user role)

### Topbar

- Navy background, brand on left (lightning bolt SVG + "Stratgos" text)
- Right side: filter toggle (icon-only, class `topbar-icon-btn`), profile avatar button
- No "Importar Excel" button

## Supabase

### Connection

- Client configured in `src/lib/supabase.ts`
- Credentials in `.env.local` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- Never commit `.env.local` to git

### Auth

- Email + password via `signIn(email, password)` — calls `supabase.auth.signInWithPassword`
- Magic link via `signInWithMagicLink(email)` — calls `supabase.auth.signInWithOtp`
- Session hydrated on load via `supabase.auth.getSession()`, kept in sync via `onAuthStateChange`
- No self-registration — accounts created by admin only

### Auth files

| File | Purpose |
|---|---|
| `src/context/AuthContext.tsx` | Provides `user`, `session`, `loading`, `signIn`, `signInWithMagicLink`, `signOut` |
| `src/hooks/useAuth.ts` | Consumes `AuthContext`; throws if used outside `AuthProvider` |
| `src/hooks/useRole.ts` | Fetches `profiles` row for current user; returns `profile`, `role`, `isAdmin`, `isGestor`, `isViewer`, `loading` |
| `src/pages/Login/Login.tsx` | Login page — two tabs (email+password, magic link); not in the router, rendered by `ProtectedRoute` |
| `src/lib/schema.sql` | `profiles` table DDL + trigger + RLS policies |

### ProtectedRoute

Defined inside `src/App.tsx`. Wraps the root `<Route>` element:
- While `loading`: shows a centered spinner
- No `user`: renders `<Login />` (replaces the entire page, no redirect)
- Authenticated: renders children (which include `<Layout>` and all child routes)

### profiles table

Columns: `id` (FK → auth.users), `email`, `full_name`, `role` (`admin | gestor | viewer`), `avatar_url`

Auto-created on signup via `handle_new_user()` trigger. Default role is `viewer`.

RLS policies:
- All authenticated users can `SELECT` all profiles
- Users can `UPDATE` their own row
- Admins can do everything (`ALL`)

### Roles

| Role | Access |
|---|---|
| `admin` | Full access + Admin page visible in sidebar |
| `gestor` | Can edit data, no Admin page |
| `viewer` | Read-only |

The Admin sidebar link is conditionally rendered: only shown when `isAdmin === true` (from `useRole`).

## Phase 3 — Data Layer

### TypeScript Types (`src/types/index.ts`)

All interfaces mirror the Supabase schema exactly. Import from `'../types/index'`.

| Type | Description |
|---|---|
| `Program` | Strategic program / portfolio entry |
| `Activity` | Work breakdown item (hierarchy via n0–n5, id0–id2) |
| `PdsItem` | Single item in a PDS list (text, optional date/status) |
| `PdsEntry` | PDS report for a program period; uses JSONB arrays (`commitments_items`, `progress_items`, `next_steps_items`, `attention_items`) |
| `FinBudgetLine` | Budget line; `values` is `Record<string, number>` (period → amount) |
| `FinContract` | Procurement contract |
| `FinInvoice` | Invoice linked to a contract |
| `FteResource` | FTE / staff resource record |
| `Risk` | Risk entry with impact, probability, mitigation |
| `Person` | People directory entry |
| `SnapshotKpi` | KPI bundle: total, concluidas, em_dia, em_atraso, exec_media |
| `Snapshot` | Point-in-time KPI snapshot; `by_n0` and `by_n1` are `Record<string, SnapshotKpi>` |
| `Profile` | User profile row (mirrors `profiles` table) |
| `UserPermission` | Per-user, per-page, per-program access level |
| `AppConfig` | Key-value app configuration stored in Supabase |
| `AccessLevel` | `'none' \| 'view' \| 'edit'` |
| `UserRole` | `'admin' \| 'gestor' \| 'viewer'` |
| `PageKey` | Union of all valid route page keys |

> **`cost_categories` schema:** `id`, `name` (text), `is_capex` (boolean). No `program_id` column — program assignments live in the join table below.
> **`cost_category_programs` join table:** `id`, `category_id` (FK → `cost_categories` ON DELETE CASCADE), `program_id` (FK → `programs` ON DELETE CASCADE), UNIQUE(`category_id`, `program_id`). Used by `CategoriasTab` (Admin → Financeiro) for many-to-many category-program assignment.

> **Note on activities:** `source` field exists in DB but is unused — omit it from types and queries. `id0` is a legacy text field — keep but prefer `program_id` for filtering.
> **`pct` and `pct_prev` scale:** Both fields are stored as **0–100** (e.g. `85` means 85%). Do NOT multiply by 100 when computing averages or displaying values. An activity is "concluída" when `pct >= 100`, not `>= 1`. The `exec_media` field in `SnapshotKpi` follows the same 0–100 convention.

### Data Hooks (`src/hooks/`)

All hooks follow the same pattern: `useEffect` with cancelled flag, proper loading/error state, and dependency arrays.

#### `usePrograms()`
```ts
const { programs, loading, error, refetch } = usePrograms()
```
Fetches all programs ordered by `sort_order`. Call `refetch()` to re-query.

#### `useActivities(filters?)`
```ts
const { activities, loading, error, refetch } = useActivities({
  program_id?: string,
  n1?: string,
  n2?: string,
  owner?: string,
  sponsor?: string,
  status?: string,
  cutoffDate?: string | null,
})
```
All filters are optional. When `cutoffDate` is provided, leaf activities past their deadline with `pct < 100` are recalculated to `status = 'atrasada'` client-side.

#### `usePdsEntries(program_id?)`
```ts
const { entries, loading, error } = usePdsEntries('uuid-or-undefined')
```
Fetches PDS entries. Uses explicit column list to get only JSONB fields (not the legacy text fields).

#### `useFinancials(program_id?)`
```ts
const { budgetLines, contracts, invoices, loading, error } = useFinancials('uuid')
```
Fetches all three financial tables in parallel with `Promise.all`.

#### `useResources(program_id?)`
```ts
const { resources, loading, error } = useResources('uuid')
```

#### `useRisks(program_id?)`
```ts
const { risks, loading, error } = useRisks('uuid')
```

#### `usePeople()`
```ts
const { people, loading, error } = usePeople()
```
Ordered by name. No program filter (people are org-wide).

#### `useSnapshots(program_id?)`
```ts
const { snapshots, loading, error } = useSnapshots('uuid')
```
Ordered by `snap_date`. When `program_id` is provided, filters client-side by checking if the key exists in `by_n0`.

#### `usePermissions()`
```ts
const { permissions, hasAccess, canEdit, loading } = usePermissions()
hasAccess('gestao-riscos', programId)  // → boolean
canEdit('actividades')                 // → boolean
```

### Permission System

Resolution order (first match wins):

1. **admin role** → always `hasAccess=true`, `canEdit=true`
2. **gestor role** → always `hasAccess=true`, `canEdit=true`
3. **Specific permission row** (matching `page` + `program_id`) → use `access_level`
4. **Page-level permission row** (`program_id = null`) → use `access_level`
5. **viewer default** → `hasAccess=true` for view pages only, `canEdit=false` always

View pages for viewer default: `dashboard`, `actividades`, `gantt`, `evolucao`, `ponto-situacao`, `exec-financeira`, `recursos`

`access_level = 'none'` always blocks access regardless of role.

### Filter Context (`src/context/FilterContext.tsx`)

Global filter state shared across all pages. Provider is in `main.tsx`, inside `AuthProvider`, outside `BrowserRouter`.

```ts
const { filters, setFilter, resetFilters, getFilteredActivities } = useFilters()
```

**`FilterState` fields:**

| Field | Type | Description |
|---|---|---|
| `programIds` | `string[]` | Selected program UUIDs |
| `n1Values` | `string[]` | Selected eixo names |
| `n2Values` | `string[]` | Selected plano names |
| `owners` | `string[]` | Selected owners |
| `sponsors` | `string[]` | Selected sponsors |
| `statuses` | `string[]` | Selected status values |
| `cutoffDate` | `string \| null` | ISO date for status recalculation |

**Cascading resets:**
- Changing `programIds` → clears `n1Values` and `n2Values`
- Changing `n1Values` → clears `n2Values`

**Usage in a page:**
```ts
const { filters, setFilter, getFilteredActivities } = useFilters()
const { activities } = useActivities({ program_id: filters.programIds[0] })
const visible = getFilteredActivities(activities)
```

## Important Rules

1. **Do NOT modify existing reusable components** without checking if other pages depend on them
1. **Always compile and test** — run `npm run build` before committing (catches TypeScript errors)
1. **One feature per commit** — small, focused commits with descriptive messages
1. **Keep the original dashboard design** — refer to the original HTML (index.html) for visual reference when in doubt
1. **No mobile or dark mode** until Phase 12
1. **Portuguese UI labels** should match the original dashboard exactly (e.g. "Resumo executivo", "Actividades", "Gestão de Riscos")

## Migration Context

This project is being migrated from a vanilla HTML/JS dashboard (single index.html + admin.html, ~7700 lines) to this React/TypeScript structure. The original used localStorage for data storage, which is being replaced by Supabase. The migration follows the phased roadmap in TODO.md.
