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

## Pipeline

### Near-term
- [ ] Edge Function for invite-user (replace Supabase Dashboard flow)
- [ ] Alert deep-links — auto-apply breadcrumb filters when navigating from an alert
- [ ] Snooze / Acknowledge alerts (Option B+C, requires `alert_actions` table)
- [ ] Plano dropdown: search + grouping by eixo when > 20 planos
- [ ] Breadcrumb secondary filters (statuses, owners, sponsors) — decide scope/UI
- [ ] Inventory local filters in pages (identify redundancy with breadcrumb)

### Medium-term
- [ ] URL params for shareable deep-links (Phase 6 — programId, eixo, plano in URL)
- [ ] Language standardization (backend PT+EN mixing — low priority, defer)
- [ ] Mobile responsive styles (Phase 13)
- [ ] Dark mode (Phase 13 — tokens prepared)

### Backlog
- [ ] Excel import / export
- [ ] Notifications / alerts system
- [ ] Audit log viewer (Admin)
- [ ] Bulk operations (multi-select activities)
