/**
 * Strategos PMO — Supabase Client
 *
 * Typed wrapper around @supabase/supabase-js client.
 * Exposes all data-fetching and mutation operations.
 */

import { createClient } from '@supabase/supabase-js';
import type {
    Activity,
    PDSEntry,
    UserMetadata,
    Snapshot,
    Risk,
    FinanceRubric,
    FinanceContract,
    FinanceInvoice,
    Finances,
    ResourceFTE,
} from '../types';

// ── ENVIRONMENT CONFIG ──────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
        '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not configured.'
    );
}

// ── CLIENT INITIALIZATION ──────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── HELPER: MAP DATABASE ROWS TO APP TYPES ─────────────────────

function mapActivity(row: any): Activity {
    return {
        nivel: row.nivel,
        nome: row.nome,
        n0: row.n0 || '',
        n1: row.n1 || '',
        n2: row.n2 || '',
        n3: row.n3 || '',
        id0: row.id0 || '1',
        id1: row.id1 || '',
        id2: row.id2 || '',
        bs: row.bs,
        bf: row.bf,
        rs: row.rs,
        rf: row.rf,
        pct: Number(row.pct || 0),
        pct_prev: Number(row.pct_prev || 0),
        status: row.status || 'Em dia',
        sponsor: row.sponsor || '',
        owner: row.owner || '',
        finish: row.finish,
        notes: row.notes,
        source: row.source,
        _supabase_id: row.id,
    };
}

function mapRisk(r: any): Risk {
    return {
        desc: r.description || '',
        impact: r.impact,
        prob: r.prob,
        status: r.status,
        mitigation: r.mitigation || '',
        _supabase_id: r.id,
    };
}

function mapRubric(r: any): FinanceRubric {
    return {
        id: r.app_id || r.id,
        categoria: r.categoria,
        capex: r.capex,
        moeda: r.moeda,
        valores: r.valores || {},
        nota: r.nota || '',
        fonte: r.fonte || '',
        _supabase_id: r.id,
    };
}

function mapContract(c: any): FinanceContract {
    return {
        id: c.app_id || c.id,
        fornecedor: c.fornecedor || '',
        categoria: c.categoria || '',
        moeda: c.moeda || '€',
        cambio_ref: c.cambio_ref,
        valor_total: c.valor_total || 0,
        data_adj: c.data_adj,
        descricao: c.descricao || '',
        _supabase_id: c.id,
    };
}

function mapInvoice(f: any): FinanceInvoice {
    return {
        id: f.app_id || f.id,
        contrato_id: f.app_contrato_id || '',
        ref: f.ref || '',
        fornecedor: f.fornecedor || '',
        doc_tipo: f.doc_tipo,
        descricao: f.descricao || '',
        valor: f.valor || 0,
        moeda: f.moeda || '€',
        cambio: f.cambio,
        data_emissao: f.data_emissao,
        data_vencimento: f.data_vencimento,
        data_pagamento: f.data_pagamento,
        estado: f.estado || 'Por facturar',
        memorando: f.memorando || '',
        _supabase_id: f.id,
    };
}

function mapFTE(r: any): ResourceFTE {
    return {
        id: r.app_id || r.id,
        nome: r.nome || '',
        unidade: r.unidade || '',
        perfil: r.perfil || '',
        tipo: r.tipo || 'interno',
        custo_dia: Number(r.custo_dia) || 0,
        id2: r.id2 || '',
        data_inicio: r.data_inicio || null,
        data_fim: r.data_fim || null,
        alocacao_pct: Number(r.alocacao_pct) || 100,
        contrato_id: r.contrato_id || '',
        estado: r.estado || 'activo',
        _supabase_id: r.id,
    };
}

function mapPDSEntry(row: any): PDSEntry {
    const risks = (row.risks || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map(mapRisk);

    const rubricas = (row.fin_rubricas || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map(mapRubric);

    const contratos = (row.fin_contratos || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map(mapContract);

    const facturas = (row.fin_facturas || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map(mapInvoice);

    const recursos = (row.fte_recursos || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map(mapFTE);

    return {
        id0: row.id0 || '1',
        id1: row.id1 || '',
        id2: row.id2 || '',
        plano: row.plano || '',
        n0: row.n0 || '',
        n1: row.n1 || '',
        compromissos_items: row.compromissos_items || [],
        avancos_items: row.avancos_items || [],
        proximos_items: row.proximos_items || [],
        atencao_items: row.atencao_items || [],
        compromissos: row.compromissos,
        avancos: row.avancos,
        proximos: row.proximos,
        atencao: row.atencao,
        risks,
        finances: {
            rubricas,
            contratos,
            facturas,
        },
        fte: {
            dias_uteis: row.fte_dias_uteis || 22,
            recursos,
        },
        _supabase_id: row.id,
    };
}

// ── AUTH ────────────────────────────────────────────────────────

export async function signIn(
    email: string,
    password: string
): Promise<{ user: any; session: any }> {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;
    return data;
}

export async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
}

export function onAuthStateChange(
    callback: (event: string, session: any) => void
) {
    return supabase.auth.onAuthStateChange(callback);
}

// ── USER / PROFILE ──────────────────────────────────────────────

export async function getUserMetadata(userId: string): Promise<UserMetadata> {
    const { data, error } = await supabase
        .from('user_metadata')
        .select('*, user_profiles(*)')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return data;
}

export async function getUserProfile(
    userId: string
): Promise<UserMetadata & { user_profiles: any }> {
    const { data, error } = await supabase
        .from('user_metadata')
        .select('*, user_profiles(*)')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return data;
}

// ── ACTIVITIES / GANTT ──────────────────────────────────────────

export async function getActivities(filters?: {
    n0?: string;
    n1?: string;
}): Promise<Activity[]> {
    let query = supabase
        .from('activities')
        .select('*')
        .eq('source', 'gantt')
        .order('sort_order', { ascending: true });

    if (filters?.n0) {
        query = query.eq('n0', filters.n0);
    }
    if (filters?.n1) {
        query = query.eq('n1', filters.n1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(mapActivity);
}

export async function saveActivities(activities: Activity[]): Promise<void> {
    // Delete old gantt activities
    await supabase.from('activities').delete().eq('source', 'gantt');

    // Insert new ones
    const rows = activities.map((r, i) => ({
        source: 'gantt',
        nivel: r.nivel,
        nome: r.nome || '',
        n0: r.n0 || '',
        n1: r.n1 || '',
        n2: r.n2 || '',
        n3: r.n3 || '',
        id0: r.id0 || '1',
        id1: r.id1 || '',
        id2: r.id2 || '',
        bs: r.bs || null,
        bf: r.bf || null,
        rs: r.rs || null,
        rf: r.rf || null,
        pct: r.pct || 0,
        pct_prev: r.pct_prev || 0,
        status: r.status || 'Em dia',
        sponsor: r.sponsor || '',
        owner: r.owner || '',
        finish: r.finish || null,
        notes: r.notes || null,
        sort_order: i,
    }));

    const { error } = await supabase.from('activities').insert(rows);

    if (error) throw error;
}

// ── PDS ENTRIES ─────────────────────────────────────────────────

export async function getPDSEntries(filters?: {
    n0?: string;
    n1?: string;
}): Promise<PDSEntry[]> {
    let query = supabase
        .from('pds_entries')
        .select(
            '*, risks(*), fin_rubricas(*), fin_contratos(*), fin_facturas(*), fte_recursos(*)'
        )
        .order('id');

    if (filters?.n0) {
        query = query.eq('n0', filters.n0);
    }
    if (filters?.n1) {
        query = query.eq('n1', filters.n1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(mapPDSEntry);
}

export async function getFilterOptions(): Promise<{
    n0Options: string[]
    n1OptionsByN0: Record<string, string[]>
}> {
    const { data, error } = await supabase
        .from('activities')
        .select('n0,n1')
        .eq('source', 'gantt');

    if (error) throw error;

    const n0OptionsSet = new Set<string>();
    const n1OptionsByN0: Record<string, string[]> = {};

        (data || []).forEach((row: any) => {
            const n0 = row.n0 || ''
            const n1 = row.n1 || ''

            if (!n0) return

            n0OptionsSet.add(n0)

            if (n1) {
                const current = n1OptionsByN0[n0] || []
                if (!current.includes(n1)) {
                    current.push(n1)
                }
                n1OptionsByN0[n0] = current
            }
        })

    const n0Options = Array.from(n0OptionsSet).sort()
    Object.keys(n1OptionsByN0).forEach((key) => {
        n1OptionsByN0[key] = Array.from(new Set(n1OptionsByN0[key])).sort()
    })

    return { n0Options, n1OptionsByN0 }
}

export async function savePDSEntry(entry: Partial<PDSEntry>): Promise<string> {
    const payload = {
        id0: entry.id0 || '1',
        id1: entry.id1 || '',
        id2: entry.id2 || '',
        plano: entry.plano || '',
        n0: entry.n0 || '',
        n1: entry.n1 || '',
        compromissos_items: entry.compromissos_items || [],
        avancos_items: entry.avancos_items || [],
        proximos_items: entry.proximos_items || [],
        atencao_items: entry.atencao_items || [],
        compromissos: entry.compromissos,
        avancos: entry.avancos,
        proximos: entry.proximos,
        atencao: entry.atencao,
    };

    if (entry._supabase_id) {
        // Update
        const { error } = await supabase
            .from('pds_entries')
            .update(payload)
            .eq('id', entry._supabase_id);

        if (error) throw error;
        return entry._supabase_id;
    } else {
        // Insert
        const { data, error } = await supabase
            .from('pds_entries')
            .insert([payload])
            .select('id');

        if (error) throw error;
        return data?.[0]?.id || '';
    }
}

// ── RISKS ───────────────────────────────────────────────────────

export async function saveRisks(pdsId: string, risks: Risk[]): Promise<void> {
    // Delete old risks
    await supabase.from('risks').delete().eq('pds_id', pdsId);

    // Insert new ones
    const rows = risks.map((r, i) => ({
        pds_id: pdsId,
        description: r.desc,
        impact: r.impact,
        prob: r.prob,
        status: r.status,
        mitigation: r.mitigation || '',
        sort_order: i,
    }));

    if (rows.length > 0) {
        const { error } = await supabase.from('risks').insert(rows);
        if (error) throw error;
    }
}

// ── FINANCES ────────────────────────────────────────────────────

export async function saveFinances(
    pdsId: string,
    finances: Finances
): Promise<void> {
    // Delete old finance entries
    await supabase.from('fin_rubricas').delete().eq('pds_id', pdsId);
    await supabase.from('fin_contratos').delete().eq('pds_id', pdsId);
    await supabase.from('fin_facturas').delete().eq('pds_id', pdsId);

    // Insert rubricas
    if (finances.rubricas && finances.rubricas.length > 0) {
        const rubricRows = finances.rubricas.map((r, i) => ({
            pds_id: pdsId,
            categoria: r.categoria,
            capex: r.capex,
            moeda: r.moeda,
            valores: r.valores || {},
            nota: r.nota || '',
            fonte: r.fonte || '',
            sort_order: i,
        }));

        const { error } = await supabase.from('fin_rubricas').insert(rubricRows);
        if (error) throw error;
    }

    // Insert contratos
    if (finances.contratos && finances.contratos.length > 0) {
        const contratoRows = finances.contratos.map((c, i) => ({
            pds_id: pdsId,
            fornecedor: c.fornecedor,
            categoria: c.categoria,
            moeda: c.moeda,
            cambio_ref: c.cambio_ref,
            valor_total: c.valor_total,
            data_adj: c.data_adj,
            descricao: c.descricao,
            sort_order: i,
        }));

        const { error } = await supabase
            .from('fin_contratos')
            .insert(contratoRows);
        if (error) throw error;
    }

    // Insert facturas
    if (finances.facturas && finances.facturas.length > 0) {
        const faturaRows = finances.facturas.map((f, i) => ({
            pds_id: pdsId,
            ref: f.ref,
            fornecedor: f.fornecedor,
            doc_tipo: f.doc_tipo,
            descricao: f.descricao,
            valor: f.valor,
            moeda: f.moeda,
            cambio: f.cambio,
            data_emissao: f.data_emissao,
            data_vencimento: f.data_vencimento,
            data_pagamento: f.data_pagamento,
            estado: f.estado,
            memorando: f.memorando,
            sort_order: i,
        }));

        const { error } = await supabase.from('fin_facturas').insert(faturaRows);
        if (error) throw error;
    }
}

// ── SNAPSHOTS ───────────────────────────────────────────────────

export async function getSnapshots(): Promise<Snapshot[]> {
    const { data, error } = await supabase
        .from('snapshots')
        .select('*')
        .order('snap_date', { ascending: true });

    if (error) throw error;

    return (data || []).map((s) => ({
        timestamp: s.snap_date,
        label: s.label,
        kpis: s.kpi || {},
        byN1: s.by_n1 || {},
        byN0: s.by_n0 || {},
        _supabase_id: s.id,
    }));
}

// ── CONFIG ──────────────────────────────────────────────────────

export async function getAppConfig() {
    const { data, error } = await supabase
        .from('app_config')
        .select('data')
        .eq('config_key', 'main')
        .single();

    if (error) throw error;
    return data?.data || null;
}
