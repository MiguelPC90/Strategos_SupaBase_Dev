# Strategos PMO - AI Agent Documentation

> **⚠️ IMPORTANT**: This file must be updated whenever the project structure, architecture, or key features change. All AI agents working on this project should read this file first.

## Project Overview

**Strategos PMO** is a strategic project management platform (Plataforma de Gestão de Projectos Estratégicos) developed in Portugal. It helps organizations manage hierarchical strategic programs with a focus on Portuguese public sector/enterprise project management.

### Core Purpose
- Manage strategic programs (N0) → initiatives (N1) → projects (N2) → activities (N3)
- Track project progress, risks, and finances
- Provide PMO dashboards and KPI tracking
- Support both desktop (index.html) and mobile (mobile.html) interfaces

### Tech Stack
- **Frontend**: Vanilla JavaScript (no build system), HTML5, CSS3
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **PWA**: Service worker for offline capabilities
- **Storage**: localStorage for session data, Supabase for persistence

---

## Project Structure

```
Strategos_SupaBase_Dev/
├── index.html          # Desktop application (main PMO interface)
├── mobile.html         # Mobile PWA interface
├── admin.html          # Admin panel for user management
├── migrate.html        # Data migration tool
├── supabase-adapter.js # Supabase client integration
├── sw.js               # Service worker for PWA
├── manifest.json       # PWA manifest
├── data/               # Local JSON data (fallback)
│   ├── act.json        # Activities data
│   ├── gantt.json      # Gantt chart data
│   └── pds.json        # PDS entries data
└── supabase/
    ├── schema.sql      # Database schema (idempotent)
    └── migrations/     # Database migrations
```

---

## Key Architecture Concepts

### 1. Hierarchical Structure (N-Levels)

The project uses a hierarchical model:

| Level | Portuguese | English | Description |
|-------|------------|---------|-------------|
| N0    | Programa/Eixo | Program/Axis | Top-level strategic program |
| N1    | Iniciativa Estratégica | Strategic Initiative | Major strategic initiative |
| N2    | Projeto | Project | Concrete project |
| N3    | Atividade | Activity/Subproject | Task or subproject |

**Important**: The system supports filtering and viewing by N1-N4 levels.

### 2. Data Models

From `supabase/schema.sql`:

- **activities**: Gantt and activity tracking (source: 'act' or 'gantt')
- **pds_entries**: PDS (Plano de Desenvolvimento Sustentável) entries
- **risks**: Risk management linked to PDS
- **fin_rubricas**: Financial rubrics/budget lines
- **fin_contratos**: Contracts
- **fin_facturas**: Invoices
- **snapshots**: KPI snapshots for historical tracking
- **change_log**: Audit log of all changes
- **user_profiles**: User permission profiles
- **user_metadata**: User metadata and roles

### 3. Authentication & Authorization

- Uses Supabase Auth (email/password)
- Roles: `admin`, `editor`, `viewer`
- Row Level Security (RLS) policies enforce permissions
- Profile-based tab access (JSONB field `tabs`)

### 4. UI Patterns

Both `index.html` and `mobile.html` share similar patterns:
- **CSS Variables**: Defined in `:root` for theming (navy: #002E5E, green: #95BB42)
- **Panel-based navigation**: Multiple panels with show/hide logic
- **Bottom sheets**: For detail views on mobile
- **Dark mode**: Supported via CSS class toggle
- **Real-time updates**: Supabase Realtime for live data

---

## Development Guidelines for AI Agents

### Before Starting Any Task

1. **Read this file** (CLAUDE.md) to understand the project
2. **Review existing code** in index.html/mobile.html for patterns
3. **Check schema.sql** for database structure

### Coding Conventions

1. **No build system**: Pure vanilla JS, no bundlers
2. **Portuguese UI**: User-facing text in Portuguese
3. **CSS Variables**: Use existing CSS variables for colors/spacing
4. **Idempotent schema**: Database migrations must be re-runnable
5. **localStorage + Supabase**: Data flows to both, with Supabase as source of truth

### Key Functions to Know

From index.html:
- `renderGantt()` - Main Gantt chart rendering
- `renderDashboard()` - PMO dashboard
- `saveToSession()` - Save to localStorage
- `syncToSupabase()` - Sync with backend
- `exportToExcel()` - Excel export

### Common Patterns

```javascript
// Supabase query pattern
const { data, error } = await supabase
  .from('activities')
  .select('*')
  .eq('source', 'gantt')
  .order('sort_order');

// Row toggle (panels)
element.classList.toggle('active');
// or
element.style.display = (element.style.display === 'none') ? '' : 'none';
```

---

## Context Maintenance

### When to Update This File

Update CLAUDE.md when:
- Adding new major features
- Changing the data model (schema.sql)
- Adding new file dependencies
- Changing the tech stack
- Creating new UI patterns

---

## Supabase Setup

### Required Environment Variables

The app expects Supabase credentials (typically in index.html):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Database Initialization

Run `supabase/schema.sql` in Supabase SQL Editor. The schema is idempotent and can be re-run.

### Realtime Configuration

Tables enabled for realtime: `activities`, `pds_entries`, `risks`, `snapshots`

---

## Quick Reference

### Color Palette
- Navy: `#002E5E` (primary)
- Green: `#95BB42` (accent/success)
- Danger: `#D94F3D`
- Warning: `#E8A020`

### Status Values
- Activities: "Em dia", "Atrasado", "Concluído"
- Risks: "Aberto", "Mitigado", "Fechado"
- Invoices: "Por facturar", "Emitida", "Paga"

### Key Files for Reference
- Full app logic: `index.html` (lines 1-7648)
- Database: `supabase/schema.sql`
- Mobile variant: `mobile.html` (lines 1-3311)

---

*Last updated: 2026-04-06*
*Primary developer: Claude Code user (MiguelPC90)*
*GitHub: https://github.com/MiguelPC90/Strategos_SupaBase_Dev*