# CLAUDE.md — Strategos

## Project Overview

Strategos is a PMO (Project Management Office) dashboard for organizations managing strategic programs and projects. It provides executive summaries, activity tracking, Gantt charts, financial execution monitoring, resource management, and risk management — all in a single web application.

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

- Navy background, brand on left (lightning bolt SVG + "Strategos" text)
- Right side: filter toggle (icon-only, class `topbar-icon-btn`), profile avatar button
- No "Importar Excel" button

## Supabase

### Connection

- Client configured in `src/lib/supabase.ts`
- Credentials in `.env.local` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- Never commit `.env.local` to git

### Auth

- Email + password authentication
- Protected routes redirect to login page
- User profile stored in Supabase

## Important Rules

1. **Do NOT modify existing reusable components** without checking if other pages depend on them
1. **Always compile and test** — run `npm run build` before committing (catches TypeScript errors)
1. **One feature per commit** — small, focused commits with descriptive messages
1. **Keep the original dashboard design** — refer to the original HTML (index.html) for visual reference when in doubt
1. **No mobile or dark mode** until Phase 12
1. **Portuguese UI labels** should match the original dashboard exactly (e.g. "Resumo executivo", "Actividades", "Gestão de Riscos")

## Migration Context

This project is being migrated from a vanilla HTML/JS dashboard (single index.html + admin.html, ~7700 lines) to this React/TypeScript structure. The original used localStorage for data storage, which is being replaced by Supabase. The migration follows the phased roadmap in TODO.md.
