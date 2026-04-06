/**
 * Strategos PMO — TypeScript Type Definitions
 *
 * All data models extracted from Supabase schema and domain logic.
 */

// ── USER & PROFILE ──────────────────────────────────────────────

export interface UserProfile {
    id: string;
    name: string;
    tabs: Record<string, unknown>;
    n0s: string[]; // Array of N0 programme IDs user can access
    created_at: string;
    updated_at: string;
}

export interface UserMetadata {
    id: string; // User UUID from auth.users
    display_name: string;
    profile_id: string | null;
    role: 'admin' | 'editor' | 'viewer';
    created_at: string;
    updated_at: string;
    user_profiles?: UserProfile;
}

export interface User {
    id: string;
    email: string;
    metadata: UserMetadata;
}

// ── ACTIVITY / GANTT ────────────────────────────────────────────

export interface Activity {
    nivel: number; // 1–4 (N1, N2, N3, N4)
    nome: string;
    n0: string; // Programme code
    n1: string; // Initiative code
    n2: string; // Project code
    n3: string; // Activity code
    id0: string; // Programme ID
    id1: string; // Initiative ID
    id2: string; // Project ID
    bs: string | null; // Baseline Start (date)
    bf: string | null; // Baseline Finish
    rs: string | null; // Real Start
    rf: string | null; // Real Finish
    pct: number; // Progress percentage
    pct_prev: number; // Previous progress
    status: 'Em dia' | 'Atrasado' | 'Concluído' | string;
    sponsor: string;
    owner: string;
    finish: string | null;
    notes: string | null;
    source?: 'gantt' | 'act';
    _supabase_id?: string;
}

// ── RISK ────────────────────────────────────────────────────────

export interface Risk {
    desc: string;
    impact: number; // 1–5
    prob: number; // Probability 1–5
    status: 'Aberto' | 'Mitigado' | 'Fechado' | string;
    mitigation: string;
    _supabase_id?: string;
}

// ── FINANCE: RUBRICS, CONTRACTS, INVOICES ───────────────────────

export interface FinanceRubric {
    id: string;
    categoria: string;
    capex: boolean;
    moeda: string;
    valores: Record<string, number>;
    nota: string;
    fonte: string;
    _supabase_id?: string;
}

export interface FinanceContract {
    id: string;
    fornecedor: string;
    categoria: string;
    moeda: string;
    cambio_ref: number;
    valor_total: number;
    data_adj: string | null;
    descricao: string;
    _supabase_id?: string;
}

export interface FinanceInvoice {
    id: string;
    contrato_id: string;
    ref: string;
    fornecedor: string;
    doc_tipo: string;
    descricao: string;
    valor: number;
    moeda: string;
    cambio: number | null;
    data_emissao: string | null;
    data_vencimento: string | null;
    data_pagamento: string | null;
    estado: 'Por facturar' | 'Emitida' | 'Paga' | string;
    memorando: string;
    _supabase_id?: string;
}

export interface Finances {
    rubricas: FinanceRubric[];
    contratos: FinanceContract[];
    facturas: FinanceInvoice[];
}

// ── FTE / RESOURCES ─────────────────────────────────────────────

export interface ResourceFTE {
    id: string;
    nome: string;
    unidade: string;
    perfil: string;
    tipo: 'interno' | 'externo' | string;
    custo_dia: number;
    id2: string;
    data_inicio: string | null;
    data_fim: string | null;
    alocacao_pct: number;
    contrato_id: string;
    estado: 'activo' | 'inactivo' | string;
    _supabase_id?: string;
}

export interface FTE {
    dias_uteis: number;
    recursos: ResourceFTE[];
}

// ── PDS ENTRY ───────────────────────────────────────────────────

export interface PDSEntry {
    id0: string;
    id1: string;
    id2: string;
    plano: string;
    n0: string;
    n1: string;
    compromissos_items: unknown[];
    avancos_items: unknown[];
    proximos_items: unknown[];
    atencao_items: unknown[];
    compromissos: string | null;
    avancos: string | null;
    proximos: string | null;
    atencao: string | null;
    risks: Risk[];
    finances: Finances;
    fte: FTE;
    _supabase_id?: string;
}

// ── SNAPSHOT (KPI History) ──────────────────────────────────────

export interface Snapshot {
    timestamp: string;
    label: string;
    kpis: Record<string, unknown>;
    byN1: Record<string, unknown>;
    byN0: Record<string, unknown>;
    _supabase_id?: string;
}

// ── FILTER STATE ────────────────────────────────────────────────

export interface Filter {
    selectedN0: string | null;
    selectedN1: string | null;
    availableN0s: string[];
    availableN1s: string[];
}

// ── API RESPONSE TYPES ──────────────────────────────────────────

export interface ApiResponse<T> {
    data: T | null;
    error: Error | null;
    loading: boolean;
}

// ── AUTH SESSION ────────────────────────────────────────────────

export interface AuthSession {
    user: {
        id: string;
        email: string;
    };
    access_token: string;
    refresh_token: string;
}
