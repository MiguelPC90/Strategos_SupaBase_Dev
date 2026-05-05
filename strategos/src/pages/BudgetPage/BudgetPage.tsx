import './BudgetPage.css'
import { useState, useMemo, useEffect, Fragment } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useFilters } from '../../context/FilterContext'
import { useAccessiblePrograms } from '../../hooks/useAccessiblePrograms'
import { usePlanos } from '../../hooks/usePlanos'
import { useFinancials } from '../../hooks/useFinancials'
import KpiCard from '../../components/KpiCard/KpiCard'
import Badge from '../../components/Badge/Badge'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import Spinner from '../../components/Spinner/Spinner'
import EmptyState from '../../components/EmptyState/EmptyState'
import GestaoFinanceira from '../GestaoFinanceira/GestaoFinanceira'
import { invoiceStatusStyle } from '../../lib/invoiceHelpers'
import { supabase } from '../../lib/supabase'

// ── Helpers ─────────────────────────────────────────────────────────
interface CurrencyOption { code: string; symbol: string }

const CURRENCY_FALLBACK: CurrencyOption[] = [
  { code: 'EUR', symbol: '€' }, { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' }, { code: 'CHF', symbol: 'CHF' },
  { code: 'AOA', symbol: 'Kz' }, { code: 'MZN', symbol: 'MT' },
]

const INV_STATUSES = ['Prevista', 'Recebida', 'Aprovada', 'Paga', 'Rejeitada']
const TODAY = new Date().toISOString().slice(0, 10)

function toEur(amount: number, rate: number | null): number { return amount * (rate ?? 1) }
function fmtEur(n: number, symbol: string): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ' + symbol
}
function lineTotal(b: { values: Record<string, number> }): number {
  return Object.values(b.values).reduce((s, v) => s + v, 0)
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// ── Types ────────────────────────────────────────────────────────────
type BpTab = 'budget' | 'contracts' | 'invoices'

interface PlanoSubRow {
  lineId: string
  catName: string | null
  isCapex: boolean | null
  yearValues: Record<string, number>
  total: number
}
interface PlanoAggRow {
  planoId: string
  planoName: string
  yearTotals: Record<string, number>
  total: number
  subRows: PlanoSubRow[]
}

// ── Component ────────────────────────────────────────────────────────
export default function BudgetPage() {
  const { filters } = useFilters()
  const programs    = useAccessiblePrograms('gestao-financeira')
  const programId   = filters.programIds[0] ?? programs[0]?.id
  const n1Name      = filters.n1Values[0]   ?? null
  const n2Name      = filters.n2Values[0]   ?? null

  const { planos, loading: planosLoading } = usePlanos(programId)
  const { budgetLines, contracts: allContracts, invoices: allInvoices, loading: finLoading } = useFinancials(programId)

  // Currencies — global, fetched once
  const [currencies,      setCurrencies]      = useState<CurrencyOption[]>(CURRENCY_FALLBACK)
  const [defaultCurrency, setDefaultCurrency] = useState('EUR')

  useEffect(() => {
    let cancelled = false
    supabase.from('currencies').select('code, is_default, symbol').order('code')
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return
        const rows = data as { code: string; is_default: boolean; symbol: string }[]
        setCurrencies(rows.map(r => ({ code: r.code, symbol: r.symbol || '€' })))
        const def = rows.find(r => r.is_default)
        if (def) setDefaultCurrency(def.code)
      })
    return () => { cancelled = true }
  }, [])

  // ── Scope derivation ─────────────────────────────────────────────
  const scopedPlanos = useMemo(() => {
    if (n2Name) return planos.filter(p => p.name === n2Name)
    if (n1Name) return planos.filter(p => p.eixo?.name === n1Name)
    return planos
  }, [planos, n1Name, n2Name])

  const scopedPlanoIds = useMemo(() => new Set(scopedPlanos.map(p => p.id)), [scopedPlanos])

  const scopedBudget    = useMemo(() =>
    budgetLines.filter(b => b.plano_id != null && scopedPlanoIds.has(b.plano_id as string)),
    [budgetLines, scopedPlanoIds])
  const scopedContracts = useMemo(() =>
    allContracts.filter(c => c.plano_id != null && scopedPlanoIds.has(c.plano_id as string)),
    [allContracts, scopedPlanoIds])
  const scopedInvoices  = useMemo(() =>
    allInvoices.filter(i => i.plano_id != null && scopedPlanoIds.has(i.plano_id as string)),
    [allInvoices, scopedPlanoIds])

  const isModeA = n2Name !== null && scopedPlanos.length === 1

  // ── KPIs ─────────────────────────────────────────────────────────
  // defaultSymbol: prefer the marked-default currency; fall back to first in list, then 'Kz'
  const defaultSymbol = useMemo(
    () => currencies.find(c => c.code === defaultCurrency)?.symbol ?? currencies[0]?.symbol ?? 'Kz',
    [currencies, defaultCurrency])

  const kpis = useMemo(() => {
    const budgetTotal = scopedBudget.reduce((s, b) => s + lineTotal(b), 0)
    const adjudicado  = scopedContracts.reduce((s, c) => s + toEur(c.total_amount, c.exchange_rate_ref), 0)
    const pago        = scopedInvoices.filter(i => i.status === 'Paga').reduce((s, i) => s + toEur(i.amount, i.exchange_rate), 0)
    const emPagamento = scopedInvoices.filter(i => i.status === 'Aprovada').reduce((s, i) => s + toEur(i.amount, i.exchange_rate), 0)
    return {
      budgetTotal, adjudicado, pago, emPagamento,
      porFacturar: adjudicado - pago - emPagamento,
      desvio:      adjudicado - budgetTotal,
    }
  }, [scopedBudget, scopedContracts, scopedInvoices])

  // ── Mode B tab + expand state ────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState<BpTab>('budget')
  const [expandedKeys,    setExpandedKeys]    = useState<Set<string>>(new Set())
  const [invStatusFilter, setInvStatusFilter] = useState('Todos')
  const [invPageSize,     setInvPageSize]     = useState(25)
  const [invPage,         setInvPage]         = useState(0)

  useEffect(() => { setInvPage(0) }, [invStatusFilter, invPageSize, scopedInvoices.length])

  // ── Mode B: rubricas by plano ────────────────────────────────────
  const budgetYears = useMemo(() => {
    const ks = new Set<string>()
    scopedBudget.forEach(b => Object.keys(b.values).forEach(k => ks.add(k)))
    return Array.from(ks).sort()
  }, [scopedBudget])

  const planoNameMap = useMemo(() => new Map(scopedPlanos.map(p => [p.id, p.name])), [scopedPlanos])

  const planoRows = useMemo((): PlanoAggRow[] => {
    // Initialise one row per scoped plano (preserves order from usePlanos)
    const rows: PlanoAggRow[] = scopedPlanos.map(p => ({
      planoId: p.id, planoName: p.name,
      yearTotals: {}, total: 0, subRows: [],
    }))
    const rowMap = new Map(rows.map(r => [r.planoId, r]))

    scopedBudget.forEach(b => {
      const planoId = b.plano_id ?? ''
      const row = rowMap.get(planoId)
      if (!row) return
      const catName = b.cost_categories?.name ?? null
      const isCapex = b.cost_categories != null ? b.cost_categories.is_capex : null
      const sub: PlanoSubRow = { lineId: b.id, catName, isCapex, yearValues: {}, total: 0 }
      Object.entries(b.values).forEach(([y, v]) => {
        row.yearTotals[y] = (row.yearTotals[y] ?? 0) + v
        sub.yearValues[y] = (sub.yearValues[y] ?? 0) + v
        row.total += v
        sub.total += v
      })
      row.subRows.push(sub)
    })

    return rows.filter(r => r.subRows.length > 0)
  }, [scopedBudget, scopedPlanos])

  const grandBudgetTotal = useMemo(() => planoRows.reduce((s, r) => s + r.total, 0), [planoRows])
  const yearGrandTotals  = useMemo(() => {
    const t: Record<string, number> = {}
    planoRows.forEach(r => budgetYears.forEach(y => { t[y] = (t[y] ?? 0) + (r.yearTotals[y] ?? 0) }))
    return t
  }, [planoRows, budgetYears])

  // ── Mode B: sorted contracts ─────────────────────────────────────
  const sortedContracts = useMemo(() => {
    const planoOrder = new Map(scopedPlanos.map((p, i) => [p.id, i]))
    return [...scopedContracts].sort((a, b) => {
      const pa = planoOrder.get(a.plano_id ?? '') ?? 999
      const pb = planoOrder.get(b.plano_id ?? '') ?? 999
      if (pa !== pb) return pa - pb
      return a.sort_order - b.sort_order
    })
  }, [scopedContracts, scopedPlanos])

  // ── Mode B: filtered + paginated invoices ────────────────────────
  const filteredInvoices = useMemo(() =>
    invStatusFilter === 'Todos'
      ? scopedInvoices
      : scopedInvoices.filter(i => i.status === invStatusFilter),
    [scopedInvoices, invStatusFilter])

  const totalInvoices = filteredInvoices.length
  const pagedInvoices = useMemo(() =>
    filteredInvoices.slice(invPage * invPageSize, (invPage + 1) * invPageSize),
    [filteredInvoices, invPage, invPageSize])

  // ── Render ────────────────────────────────────────────────────────
  const loading = planosLoading || finLoading
  if (loading) return <Spinner />

  if (isModeA) {
    return (
      <GestaoFinanceira
        planoId={scopedPlanos[0].id}
        programId={programId}
      />
    )
  }

  if (scopedPlanos.length === 0) {
    return (
      <EmptyState
        icon="data"
        title="Sem planos de acção"
        description={
          n2Name  ? `O plano "${n2Name}" não existe neste programa.`
          : n1Name ? `Sem planos no eixo "${n1Name}".`
          : 'Não existem planos de acção disponíveis para este programa.'
        }
      />
    )
  }

  const disabledBtnStyle: React.CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }
  const disabledTitle = 'Selecciona um plano específico para criar'

  const TABS: { id: BpTab; label: string }[] = [
    { id: 'budget',    label: 'Orçamento'  },
    { id: 'contracts', label: 'Contratos'  },
    { id: 'invoices',  label: 'Facturas'   },
  ]

  return (
    <div className="bp-page">
      {/* ── KPI row — always visible ── */}
      <div className="gf-kpi-row">
        <KpiCard label="Orçamento Total"  value={fmtEur(kpis.budgetTotal,  defaultSymbol)} color="navy"  />
        <KpiCard label="Adjudicado"        value={fmtEur(kpis.adjudicado,  defaultSymbol)} color="blue"  />
        <KpiCard label="Pago"              value={fmtEur(kpis.pago,         defaultSymbol)} color="green" />
        <KpiCard label="Em Pagamento"      value={fmtEur(kpis.emPagamento, defaultSymbol)} color="amber" />
        <KpiCard label="Por Facturar"      value={fmtEur(Math.max(0, kpis.porFacturar), defaultSymbol)} color="text" />
        <KpiCard
          label="Desvio"
          value={fmtEur(Math.abs(kpis.desvio), defaultSymbol)}
          subtitle={kpis.desvio > 0 ? 'acima do orçamento' : kpis.desvio < 0 ? 'dentro do orçamento' : ''}
          color={kpis.desvio > 0 ? 'red' : 'green'}
        />
      </div>

      {/* ── Tab nav ── */}
      <div className="bp-tab-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`bp-tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {/* ── Orçamento tab ── */}
      {activeTab === 'budget' && (
        <div className="gf-budget-wrap">
          <div className="gf-budget-toolbar">
            <span className="gf-budget-toolbar-title">Rubricas Orçamentais</span>
            <button className="btn-primary" disabled title={disabledTitle} style={disabledBtnStyle}>
              + Rubrica
            </button>
          </div>
          {planoRows.length === 0 ? (
            <div className="gf-empty" style={{ border: 'none' }}>Sem rubricas orçamentais.</div>
          ) : (
            <table className="gf-budget-table tbl-default">
              <thead>
                <tr>
                  <th className="t-label" style={{ width: 28 }} />
                  <th className="t-label" style={{ minWidth: 200 }}>Plano</th>
                  <th className="t-label" style={{ width: 160 }}>Rubrica</th>
                  <th className="gf-th-c t-label" style={{ width: 72 }}>Tipo</th>
                  {budgetYears.map(y => (
                    <th key={y} className="gf-th-r t-label" style={{ width: 110 }}>{y}</th>
                  ))}
                  <th className="gf-th-r t-label" style={{ width: 110 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {planoRows.map(row => {
                  const isExpanded = expandedKeys.has(row.planoId)
                  const toggle = () => setExpandedKeys(prev => {
                    const next = new Set(prev)
                    if (next.has(row.planoId)) next.delete(row.planoId)
                    else next.add(row.planoId)
                    return next
                  })
                  return (
                    <Fragment key={row.planoId}>
                      <tr className="bp-agg-row" onClick={toggle}>
                        <td>
                          <button
                            className="gf-icon-btn"
                            onClick={e => { e.stopPropagation(); toggle() }}
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td style={{ fontWeight: 600 }}>{row.planoName}</td>
                        <td style={{ color: 'var(--text3)', fontSize: 13 }}>—</td>
                        <td className="gf-td-c" style={{ color: 'var(--text3)', fontSize: 13 }}>—</td>
                        {budgetYears.map(y => (
                          <td key={y} className="gf-td-r">{fmtEur(row.yearTotals[y] ?? 0, defaultSymbol)}</td>
                        ))}
                        <td className="gf-td-total">{fmtEur(row.total, defaultSymbol)}</td>
                      </tr>
                      {isExpanded && row.subRows.map(sub => (
                        <tr key={sub.lineId} className="bp-sub-row">
                          <td />
                          <td style={{ paddingLeft: 28, color: 'var(--text2)', fontSize: 12 }}>
                            {sub.catName ?? <span style={{ color: 'var(--text3)' }}>Sem categoria</span>}
                          </td>
                          <td />
                          <td className="gf-td-c">
                            {sub.isCapex !== null ? (
                              <span style={{
                                display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                                fontSize: 11, fontWeight: 500,
                                background: sub.isCapex ? '#EBF0FA' : '#FDF3E7',
                                color: sub.isCapex ? 'var(--blue)' : 'var(--amber)',
                              }}>
                                {sub.isCapex ? 'CAPEX' : 'OPEX'}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          {budgetYears.map(y => (
                            <td key={y} className="gf-td-r" style={{ color: 'var(--text2)', fontSize: 12 }}>
                              {fmtEur(sub.yearValues[y] ?? 0, defaultSymbol)}
                            </td>
                          ))}
                          <td className="gf-td-r" style={{ color: 'var(--text2)', fontSize: 12, fontWeight: 600 }}>
                            {fmtEur(sub.total, defaultSymbol)}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="gf-total-row">
                  <td />
                  <td colSpan={3}>Total orçamentado</td>
                  {budgetYears.map(y => (
                    <td key={y} className="gf-td-r">{fmtEur(yearGrandTotals[y] ?? 0, defaultSymbol)}</td>
                  ))}
                  <td className="gf-td-r">{fmtEur(grandBudgetTotal, defaultSymbol)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ── Contratos tab ── */}
      {activeTab === 'contracts' && (
        <div className="gf-contracts-wrap">
          <div className="gf-contracts-toolbar">
            <button className="btn-primary" disabled title={disabledTitle} style={disabledBtnStyle}>
              + Novo Contrato
            </button>
          </div>
          {sortedContracts.length === 0 ? (
            <div className="gf-empty">Sem contratos.</div>
          ) : (
            sortedContracts.map(c => {
              const sym         = currencies.find(cur => cur.code === c.currency)?.symbol ?? defaultSymbol
              const invoicedEur = scopedInvoices
                .filter(i => i.app_contract_id === c.app_id || i.contract_id === c.id)
                .reduce((s, i) => s + toEur(i.amount, i.exchange_rate), 0)
              const totalEur       = toEur(c.total_amount, c.exchange_rate_ref)
              const nativeInvoiced = c.exchange_rate_ref ? invoicedEur / c.exchange_rate_ref : invoicedEur
              const pct            = totalEur > 0 ? Math.round((invoicedEur / totalEur) * 100) : 0
              const planoName      = planoNameMap.get(c.plano_id ?? '') ?? ''
              return (
                <div key={c.id} className="gf-contract-card">
                  <div className="gf-contract-header">
                    <div style={{ flex: 1 }}>
                      <div className="gf-contract-title">{c.supplier || '(sem fornecedor)'}</div>
                      {planoName && (
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                          <span className="gf-meta-label" style={{ marginRight: 4 }}>Plano</span>
                          {planoName}
                        </div>
                      )}
                      {c.category && <Badge variant="grey">{c.category}</Badge>}
                    </div>
                  </div>
                  <div className="gf-contract-meta">
                    <div className="gf-contract-meta-item">
                      <span className="gf-meta-label">Valor Total</span>
                      <span className="gf-meta-value" style={{ color: 'var(--navy)', fontWeight: 700 }}>
                        {fmtEur(c.total_amount, sym)}
                      </span>
                    </div>
                    {c.award_date && (
                      <div className="gf-contract-meta-item">
                        <span className="gf-meta-label">Adjudicação</span>
                        <span className="gf-meta-value">{fmtDate(c.award_date)}</span>
                      </div>
                    )}
                    {c.end_date && (
                      <div className="gf-contract-meta-item">
                        <span className="gf-meta-label">Fim</span>
                        <span className="gf-meta-value">{fmtDate(c.end_date)}</span>
                      </div>
                    )}
                    {c.description && (
                      <div className="gf-contract-meta-item" style={{ flex: 1 }}>
                        <span className="gf-meta-label">Descrição</span>
                        <span className="gf-meta-value">{c.description}</span>
                      </div>
                    )}
                  </div>
                  <div className="gf-contract-progress">
                    <div className="gf-contract-progress-label">
                      <span>Facturado</span>
                      <span>{fmtEur(nativeInvoiced, sym)} / {fmtEur(c.total_amount, sym)}</span>
                    </div>
                    <ProgressBar value={pct} color={pct > 100 ? 'red' : 'blue'} showLabel />
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Facturas tab ── */}
      {activeTab === 'invoices' && (
        <div className="gf-invoices-wrap">
          <div className="gf-invoices-toolbar">
            <div className="gf-status-chips">
              {['Todos', ...INV_STATUSES].map(s => (
                <button
                  key={s}
                  className={`gf-chip${invStatusFilter === s ? ' gf-chip--active' : ''}`}
                  onClick={() => setInvStatusFilter(s)}
                >{s}</button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button className="btn-primary" disabled title={disabledTitle} style={disabledBtnStyle}>
              + Factura
            </button>
          </div>

          <div className="gf-invoices-table-wrap">
            {pagedInvoices.length === 0 ? (
              <div className="gf-empty" style={{ border: 'none' }}>
                {scopedInvoices.length === 0 ? 'Sem facturas.' : 'Nenhuma factura com este estado.'}
              </div>
            ) : (
              <table className="gf-invoices-table tbl-default" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th className="t-label" style={{ width: 100 }}>Referência</th>
                    <th className="t-label" style={{ width: 130 }}>Fornecedor</th>
                    <th className="t-label" style={{ width: 150 }}>Contrato</th>
                    <th className="t-label" style={{ width: 130 }}>Plano</th>
                    <th className="t-label" style={{ width: 80 }}>Tipo Doc.</th>
                    <th className="gf-th-r t-label" style={{ width: 110 }}>Montante</th>
                    <th className="t-label" style={{ width: 86 }}>Emissão</th>
                    <th className="t-label" style={{ width: 86 }}>Vencimento</th>
                    <th className="t-label" style={{ width: 86 }}>Pagamento</th>
                    <th className="t-label" style={{ width: 80 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedInvoices.map(inv => {
                    const overdue   = !!inv.due_date && inv.due_date < TODAY && inv.status !== 'Paga' && inv.status !== 'Rejeitada'
                    const sym       = currencies.find(c => c.code === inv.currency)?.symbol ?? defaultSymbol
                    const linked    = scopedContracts.find(c => c.app_id === inv.app_contract_id || c.id === inv.contract_id)
                    const planoName = planoNameMap.get(inv.plano_id ?? '') ?? ''
                    const st        = invoiceStatusStyle(inv.status)
                    return (
                      <tr key={inv.id} className={`gf-inv-row${overdue ? ' gf-inv-row--overdue' : ''}`}>
                        <td className="gf-td-wrap">{inv.ref || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td className="gf-td-wrap">{inv.supplier || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td className="gf-td-wrap" style={{ color: 'var(--text2)', fontSize: 12 }}>
                          {linked ? (linked.description || linked.supplier) : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {planoName || <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12 }}>{inv.doc_type ?? '—'}</td>
                        <td className="gf-td-r">{fmtEur(inv.amount, sym)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(inv.issue_date)}</td>
                        <td style={{
                          fontSize: 12,
                          color: overdue ? 'var(--red)' : 'var(--text2)',
                          fontWeight: overdue ? 700 : undefined,
                        }}>
                          {fmtDate(inv.due_date)}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(inv.payment_date)}</td>
                        <td>
                          <span className="status-pill" style={{ background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {totalInvoices > 0 && (
            <div className="bp-pagination">
              <span className="bp-page-info">
                {invPage * invPageSize + 1}–{Math.min((invPage + 1) * invPageSize, totalInvoices)} de {totalInvoices}
              </span>
              <div style={{ flex: 1 }} />
              <select
                className="styled-select-sm"
                value={invPageSize}
                onChange={e => setInvPageSize(Number(e.target.value))}
                style={{ width: 'auto' }}
              >
                {[10, 25, 50].map(n => <option key={n} value={n}>{n} por página</option>)}
              </select>
              <button
                className="btn"
                onClick={() => setInvPage(p => p - 1)}
                disabled={invPage === 0}
              >← Anterior</button>
              <button
                className="btn"
                onClick={() => setInvPage(p => p + 1)}
                disabled={(invPage + 1) * invPageSize >= totalInvoices}
              >Próxima →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
