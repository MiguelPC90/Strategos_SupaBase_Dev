// ─────────────────────────────────────────────────────────────
// Stratgos — Shared TypeScript Types
// Mirrors the Supabase PostgreSQL schema exactly.
// ─────────────────────────────────────────────────────────────

// ── Utility types ─────────────────────────────────────────────
export type AccessLevel = 'none' | 'view' | 'edit'
export type UserRole    = 'admin' | 'editor' | 'viewer'
export type PageKey =
  | 'dashboard'
  | 'actividades'
  | 'gantt'
  | 'evolucao'
  | 'ponto-situacao'
  | 'exec-financeira'
  | 'recursos'
  | 'gestao-iniciativas'
  | 'gestao-pds'
  | 'gestao-riscos'
  | 'gestao-financeira'
  | 'gestao-recursos'
  | 'admin'

// ── Eixos ─────────────────────────────────────────────────────
export interface Eixo {
  id: string
  program_id: string | null
  code: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

// ── Planos ────────────────────────────────────────────────────
export interface Plano {
  id: string
  eixo_id: string
  program_id: string | null
  code: string
  name: string
  owner: string | null
  sponsor: string | null
  sort_order: number
  created_at: string
  updated_at: string
  /** Joined from eixos when queried with eixo:eixos(name,code) */
  eixo: { name: string; code: string } | null
}

// ── programs ──────────────────────────────────────────────────
export interface Program {
  id: string
  code: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// ── activities ────────────────────────────────────────────────
export interface Activity {
  id: string
  level: number
  name: string
  /** Hierarchy label level 0 (eixo) */
  n0: string
  /** Hierarchy label level 1 */
  n1: string
  /** Hierarchy label level 2 */
  n2: string
  n3: string
  n4: string
  n5: string
  /** Legacy text ID at level 0 — keep but prefer program_id for queries */
  id0: string
  id1: string
  id2: string
  program_id: string | null
  /** UUID of the linked plano (null for legacy data) */
  plano_id: string | null
  /** Baseline start */
  bs: string | null
  /** Baseline finish */
  bf: string | null
  /** Real start */
  rs: string | null
  /** Real finish */
  rf: string | null
  pct: number
  pct_prev: number
  status: string
  sponsor: string
  owner: string
  finish: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
  updated_by: string | null
}

// ── PDS entries ───────────────────────────────────────────────
export interface PdsItem {
  text: string
  date?: string
  status?: string
}

export interface PdsEntry {
  id: string
  id0: string
  id1: string
  id2: string
  plan_name: string
  n0: string
  n1: string
  program_id: string | null
  commitments_items: PdsItem[]
  progress_items: PdsItem[]
  next_steps_items: PdsItem[]
  attention_items: PdsItem[]
  fte_working_days: number | null
  created_at: string
  updated_at: string
}

// ── Financial — budget lines ───────────────────────────────────
export interface FinBudgetLine {
  id: string
  pds_id: string | null
  plano_id: string | null
  app_id: string
  program_id: string | null
  category: string
  capex: boolean
  currency: string
  /** Map of period key → amount, e.g. { "2024": 50000 } */
  values: Record<string, number>
  note: string | null
  source_ref: string | null
  sort_order: number
}

// ── Financial — contracts ─────────────────────────────────────
export interface FinContract {
  id: string
  pds_id: string | null
  plano_id: string | null
  app_id: string
  program_id: string | null
  supplier: string
  category: string
  currency: string
  exchange_rate_ref: number | null
  total_amount: number
  award_date: string | null
  end_date: string | null
  description: string | null
  sort_order: number
}

// ── Financial — invoices ──────────────────────────────────────
export type InvoiceStatus =
  | 'Prevista'
  | 'Recebida'
  | 'Aprovada'
  | 'Paga'
  | 'Rejeitada'

export interface FinInvoice {
  id: string
  pds_id: string | null
  plano_id: string | null
  contract_id: string | null
  app_id: string
  app_contract_id: string
  program_id: string | null
  ref: string
  supplier: string
  doc_type: string | null
  description: string | null
  amount: number
  currency: string
  exchange_rate: number | null
  issue_date: string | null
  due_date: string | null
  payment_date: string | null
  status: InvoiceStatus
  memo: string | null
  sort_order: number
}

// ── FTE resources ─────────────────────────────────────────────
export interface FteResource {
  id: string
  pds_id: string
  app_id: string
  program_id: string | null
  name: string
  org_unit: string | null
  role: string | null
  type: string | null
  daily_cost: number | null
  id2: string | null
  start_date: string | null
  end_date: string | null
  allocation_pct: number | null
  person_id: string | null
  contract_id: string | null
  status: string | null
  sort_order: number | null
}

// ── Risks ─────────────────────────────────────────────────────
export interface Risk {
  id: string
  pds_id: string | null
  plano_id: string | null
  program_id: string | null
  description: string
  impact: number
  probability: number
  status: string
  mitigation: string
  sort_order: number
}

// ── People directory ──────────────────────────────────────────
export interface Person {
  id: string
  name: string
  email: string | null
  org_unit: string | null
  role: string | null
  type: string | null
  notes: string | null
  active: boolean
  sort_order: number
}

// ── Snapshots ─────────────────────────────────────────────────
export interface SnapshotKpi {
  total: number
  concluidas: number
  em_dia: number
  em_atraso: number
  exec_media: number
  /** Average pct_prev (0–100) — planned execution objective at snapshot time */
  exec_media_prev?: number
  /** Activities with bs != null and bs <= snap_date (denominator for conc à data) */
  conc_a_data_denom?: number
}

export interface Snapshot {
  id: string
  label: string
  snap_date: string
  kpi: SnapshotKpi
  /** KPIs keyed by n1 value */
  by_n1: Record<string, SnapshotKpi>
  /** KPIs keyed by n0/program value */
  by_n0: Record<string, SnapshotKpi>
  created_by: string | null
}

// ── User profile ──────────────────────────────────────────────
export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// ── User permissions ──────────────────────────────────────────
export interface UserPermission {
  id: string
  user_id: string
  program_id: string | null
  plan_id: string | null
  page: string
  access_level: AccessLevel
}

// ── App config ────────────────────────────────────────────────
export interface AppConfig {
  id: string
  config_key: string
  data: Record<string, unknown>
  updated_at: string
}
