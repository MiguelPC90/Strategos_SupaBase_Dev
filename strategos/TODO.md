# TODO — Stratgos Migration

## Done

### Phase 1 — Project Setup
- [x] Vite + React 19 + TypeScript + Tailwind v4 scaffold
- [x] Supabase client + env config
- [x] Router (react-router-dom v7)
- [x] Global design tokens (index.css)

### Phase 2 — Layout & Navigation
- [x] Layout component (sidebar + topbar + content area)
- [x] Sidebar with icon-only collapse, hover expand
- [x] Active route highlighting (view vs gestão)
- [x] Page placeholders for all routes

### Phase 3 — Data Layer
- [x] TypeScript types (types/index.ts)
- [x] All data hooks (usePrograms, useActivities, usePdsEntries, useFinancials, useResources, useRisks, usePeople, useSnapshots)
- [x] Auth context + useAuth hook
- [x] useRole hook
- [x] ProtectedRoute with Login page
- [x] FilterContext with getFilteredActivities

### Phase 4 — Pages (View)
- [x] Dashboard
- [x] Actividades (tree view + search)
- [x] Gantt
- [x] Evolução (trendlines)
- [x] Ponto de Situação (PDS read)
- [x] Execução Financeira
- [x] Recursos (FTE portfolio)

### Phase 5 — Pages (Gestão)
- [x] Gestão de Iniciativas
- [x] Gestão de PDS
- [x] Gestão de Riscos
- [x] Gestão Financeira
- [x] Gestão de Recursos
- [x] Admin (programs, users, permissions matrix)

### Phase 6 — Shared Libs
- [x] rollup.ts (status rollup logic)
- [x] riskColors.ts
- [x] healthRules.ts
- [x] invoiceHelpers.ts
- [x] activityDependencies.ts
- [x] tokens.ts (brand color system)

### Phase 7 — RLS & Permissions
- [x] RLS Phase 1: profiles table policies
- [x] RLS Phase 2: SELECT policies on all tables
- [x] RLS Phase 3: admin + user_profiles setup
- [x] RLS Phase 4 (DB): Migration 021 — `user_can_edit_program_page()` function + 21 write policies
- [x] RLS Phase 4a: Fix key mismatch `execucao-financeira` → `exec-financeira` (Migration 020)
- [x] RLS Phase 4b: Frontend read-only mode — `useCanEditCurrent`, "Só leitura" badge, edit buttons hidden
- [x] RLS Phase 4c: Sidebar filtered by hasAccess (verified, working)
- [x] RLS Phase 5: Page-aware program filtering (`useAccessiblePrograms`)
- [x] Admin UI: matrix dropdown hides 'edit' for viewers; role downgrade modal with edit-row count
- [x] Deny-by-default: user with 0 permissions sees nothing (frontend + DB)
- [x] hasAccess/canEdit fallthrough bug fix (return false when no matching row for programId)
- [x] Parallel breadcrumb with cascade + auto-fill + sessionStorage + accessibleProgramIds boundary
- [x] Supabase auth trigger fix (`handle_new_user` missing `SET search_path = public`)

---

### May 2026 — Branding + Admin Rework

- [x] `a7cd288` — Dynamic branding: BrandingContext + 2 cobranding modes (stratgos / cobrand)
  - 4 brand PNG assets in public/ (stratgos-mark, stratgos-primary, stratgos-horizontal-reversed, stratgos-mark-ember)
  - Wordmark + g-mark components; topbar renders mode-appropriate brand block
  - Topbar Mode 1 (stratgos): wordmark only; Mode 2 (cobrand): g-mark + divider + client logo + name + subtitle
  - SplashScreen: light bg + 80px wordmark; footer: "Powered by" + 18px wordmark
  - Admin Geral: "Modo de identidade" radio selector with live refresh via BrandingContext
  - Migration 031: seed `branding_mode='stratgos'` in app_config
  - Favicon: trimmed transparent padding (2368x2368 → 1856x1856)
- [x] `7937dc0` — Login page rebranded: removed old topbar; brand area centered above card (48px)
  - Wordmark-only (stratgos) or wordmark + "x" + client logo (cobrand)
  - Submit button: width auto, min-width 140px, centered; SplashScreen size aligned to 80px
- [x] `22cfb99` — Admin foundation cleanup + restructure + Plano tab
  - 7 emojis → Lucide (X, Pencil, Trash2, AlertCircle); hardcoded hex → tokens (--blue-bg, --amber-bg, var(--r))
  - change_log fixes: action→operation, user_id→changed_by, created_at→changed_at
  - Histórico: expandable JSON old/new value diff
  - New "Plano" tab consolidating thresholds, saúde, ocultar, alertas (removed standalone Alertas tab)
  - Tab order: Geral → Users → Programas → Plano → Recursos → Financeiro → Risco → Dados → Histórico
  - Plano fields: auto-save on blur, inline "Guardado" indicator, .styled-select-sm for Severidade dropdown
- [x] `9040375` — User profile page at /profile with live topbar updates
  - Identity card: 80px ember initials avatar, full_name edit, read-only email, role badge (Badge component)
  - Password change card: re-authentication flow (signInWithPassword + updateUser)
  - ProfileContext (mirrors BrandingContext): topbar avatar initials update live on name save
  - Layout consumes useProfile() for display name/initials; avatar dropdown links to /profile
- [x] `c184a8a` — Admin user/person polish + Pessoas profile_id linking
  - viewer role consolidated → stakeholder across UserRole, useRole, ROLE_LABEL, InviteForm, viewOnlyRoles
  - Migration 032: UPDATE profiles SET role='stakeholder' WHERE role='viewer'
  - Invite form default unified to 'stakeholder'; admin-role rows: edit/delete disabled with tooltip
  - Pessoas: profile_id editable via SearchableSelect; auto-fill email from selected profile; email input disabled when linked (adm-row-input--linked)
  - Column reorder: Nome → Utilizador → Email → Empresa → Tipo
  - SearchableSelect: position:fixed dropdown via getBoundingClientRect() (escapes Card overflow:clip); close on scroll/resize; min-width 280px; label fallback to email when full_name is null

---

## Pipeline

### Quick polish (1 small session each)
- [ ] Edge Function for invite-user (replace Supabase Dashboard flow)
- [ ] Alert deep-links — auto-apply breadcrumb filters when navigating from an alert
- [ ] Plano dropdown: search + grouping by eixo when > 20 planos
- [ ] Inventory local filters in pages (identify redundancy with breadcrumb)
- [ ] "Guardado" indicator in section header (not per-field, reduces layout shift)
- [ ] Native `<select>` polish in remaining Admin spots (Registo filters, Users role select)
- [ ] `.gitignore` add `*.save` (nano backup files)
- [ ] "vs Xd" label: make dynamic for orgs without 7-day snapshot history
- [ ] `.t-body-l` typography class on Visão Executiva narrative text
- [ ] Lucide Paperclip in NovoPlanoModal Step 2 (replaces current fallback)

### Medium waves (~2 sessions each)
- [ ] Wave C — Rótulos integration (N2="Plano", hook + Tier 1 FilterBar/Breadcrumb first; PlanosCatalog Mode B)
- [ ] Wave E — Import hardening (transactional, FK validation, clear-first option)
- [ ] Wave H — Plan-level permissions (UX decisions pending: granularity, fallback hierarchy, migration of program-level rows)
- [ ] Breadcrumb secondary filters (statuses, owners, sponsors) — decide scope/UI
- [ ] URL params for shareable deep-links (Phase 6 — programId, eixo, plano in URL)
- [ ] Forgot password (logged-out reset flow + /reset-password page)
- [ ] Notifications (Plano sub-section workspace + Profile sub-section personal preferences)
- [ ] DB trigger: people.email auto-sync when profiles.email changes (snapshot staleness fix)

### Bigger refactors
- [ ] Rename PT→EN source files (Actividades, Recursos, Evolucao, PlanoPage, PlanosCatalog → Activities, Resources, etc.)
- [ ] Phase 13.5.5 — Lucide icons across all remaining Admin UI (full icon pass)
- [ ] Phase 13.7 — Cmd+K command bar expansion
- [ ] Phase 13.8 — G3 status propagation + per-program threshold UI
- [ ] Language standardization (backend PT+EN mixing — low priority, defer)
- [ ] Mobile responsive styles (Phase 13)
- [ ] Dark mode (Phase 13 — tokens prepared)

### Critical (fresh sessions)
- [ ] Snooze / Acknowledge alerts (Option B+C, requires `alert_actions` table)
- [ ] Additional Admin improvements audit (items not yet touched in current pass)
- [ ] DEV/PROD environment split (Supabase + Cloudflare staging)
- [ ] Multitenancy Phase 15 (5-8 sessions, large refactor)
  - Dependencies: whitelabel mode (topbar + login + splash), client logo light/dark variants, branding admin separation (super-admin console outside client app)

### Backlog
- [ ] Excel import / export
- [ ] Bulk operations (multi-select activities)
- [ ] Audit log viewer (Admin — Histórico tab lays the foundation)
