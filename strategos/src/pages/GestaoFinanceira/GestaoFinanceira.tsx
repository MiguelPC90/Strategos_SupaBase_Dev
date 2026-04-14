import './GestaoFinanceira.css'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useFilters } from '../../context/FilterContext'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import { useFinancials } from '../../hooks/useFinancials'
import KpiCard from '../../components/KpiCard/KpiCard'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import Badge from '../../components/Badge/Badge'
import type { FinBudgetLine, FinContract, FinInvoice } from '../../types/index'

// ── Types ──────────────────────────────────────────────────────────
type Tab = 'orcamento' | 'contratos' | 'facturas'

interface PlanOption {
  key: string
  label: string
  n0: string; n1: string; n2: string
  id0: string; id1: string; id2: string
  program_id: string | null
}

interface DraftState {
  budget: FinBudgetLine[]
  contracts: FinContract[]
  invoices: FinInvoice[]
}

interface ContractForm {
  id: string | null
  supplier: string
  category: string
  total_amount: string
  currency: string
  exchange_rate_ref: string
  award_date: string
  description: string
}

// ── Constants ──────────────────────────────────────────────────────
const EMPTY_DRAFT: DraftState = { budget: [], contracts: [], invoices: [] }

const BLANK_CONTRACT: ContractForm = {
  id: null, supplier: '', category: '', total_amount: '',
  currency: 'EUR', exchange_rate_ref: '', award_date: '', description: '',
}

const CURRENCY_FALLBACK = ['EUR', 'USD', 'GBP', 'CHF', 'AOA', 'MZN']
const DOC_TYPES  = ['Factura', 'Recibo', 'Nota de Crédito', 'Pró-forma', 'Outro']
const INV_STATUSES = ['Pendente', 'Aprovado', 'Paga', 'Anulada']
const TODAY = new Date().toISOString().slice(0, 10)

// ── Helpers ────────────────────────────────────────────────────────
let _seq = 0
function newId(): string { return 'new_' + (++_seq) + '_' + Math.random().toString(36).slice(2, 6) }
function newAppId(): string { return 'gf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }
function isNew(id: string): boolean { return id.startsWith('new_') }
function toEur(amount: number, rate: number | null): number { return amount * (rate ?? 1) }
function fmtEur(n: number): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
}
function lineTotal(b: FinBudgetLine): number {
  return Object.values(b.values).reduce((s, v) => s + v, 0)
}

// ── BudgetTab ──────────────────────────────────────────────────────
interface BudgetTabProps {
  lines: FinBudgetLine[]
  setLines: (lines: FinBudgetLine[]) => void
  onDelete: (id: string) => void
  /** Category names configured in Admin → Financeiro for this program */
  categories: string[]
  /** Currency codes from the currencies table */
  currencies: string[]
  /** Default currency code (is_default = true) */
  defaultCurrency: string
  /** Management years configured in Admin → Financeiro for this program */
  managementYears: string[]
}

function BudgetTab({ lines, setLines, onDelete, categories, currencies, defaultCurrency, managementYears }: BudgetTabProps) {
  const [newYear, setNewYear] = useState(String(new Date().getFullYear() + 1))

  // Seed from management_years; merge with any year keys already on lines
  const years = useMemo(() => {
    const ks = new Set<string>(managementYears)
    lines.forEach(b => Object.keys(b.values).forEach(k => ks.add(k)))
    return Array.from(ks).sort()
  }, [lines, managementYears])

  const updateLine = (id: string, patch: Partial<FinBudgetLine>) =>
    setLines(lines.map(b => b.id === id ? { ...b, ...patch } : b))

  const setYearValue = (id: string, year: string, val: string) => {
    const num = parseFloat(val.replace(',', '.')) || 0
    setLines(lines.map(b => b.id === id ? { ...b, values: { ...b.values, [year]: num } } : b))
  }

  const addYear = () => {
    const y = newYear.trim()
    if (!y || years.includes(y)) return
    setLines(lines.map(b => ({ ...b, values: { ...b.values, [y]: 0 } })))
  }

  const removeYear = (y: string) =>
    setLines(lines.map(b => {
      const v = { ...b.values }
      delete v[y]
      return { ...b, values: v }
    }))

  const addRow = () => {
    const baseValues: Record<string, number> = {}
    years.forEach(y => { baseValues[y] = 0 })
    setLines([...lines, {
      id: newId(), pds_id: null, plano_id: null, app_id: newAppId(), program_id: null,
      category: '', capex: false, currency: defaultCurrency,
      values: baseValues, note: null, source_ref: null, sort_order: lines.length,
    }])
  }

  const total = useMemo(() => lines.reduce((s, b) => s + lineTotal(b), 0), [lines])

  return (
    <div className="gf-budget-wrap">
      <div className="gf-budget-toolbar">
        <span className="gf-budget-toolbar-title">Rubricas Orçamentais</span>
        <input
          type="number"
          className="gf-cell-input"
          value={newYear}
          onChange={e => setNewYear(e.target.value)}
          style={{ width: 72, padding: '3px 6px', fontSize: 12 }}
          placeholder="Ano"
        />
        <button className="gf-btn" onClick={addYear} style={{ fontSize: 12 }}>+ Ano</button>
        <button className="gf-btn gf-btn-primary" onClick={addRow}>+ Rubrica</button>
      </div>

      {lines.length === 0 ? (
        <div className="gf-empty" style={{ border: 'none' }}>Sem rubricas. Clique em + Rubrica para adicionar.</div>
      ) : (
        <table className="gf-budget-table">
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <th style={{ width: 180 }}>Rubrica</th>
              <th className="gf-th-c" style={{ width: 72 }}>Tipo</th>
              <th className="gf-th-c" style={{ width: 62 }}>Moeda</th>
              {years.map(y => (
                <th key={y} className="gf-th-r" style={{ width: 110 }}>
                  {y}
                  <button
                    className="gf-icon-btn"
                    onClick={() => removeYear(y)}
                    style={{ display: 'inline-flex', fontSize: 10, width: 14, height: 14, marginLeft: 3, verticalAlign: 'middle' }}
                    title={`Remover coluna ${y}`}
                  >✕</button>
                </th>
              ))}
              <th className="gf-th-r" style={{ width: 110 }}>Total</th>
              <th style={{ width: 120 }}>Nota</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(b => (
              <tr key={b.id}>
                <td>
                  <button className="gf-icon-btn" onClick={() => onDelete(b.id)} title="Remover">✕</button>
                </td>
                <td>
                  <select className="gf-cell-select" value={b.category}
                    onChange={e => updateLine(b.id, { category: e.target.value })}>
                    <option value="">— categoria —</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    {/* Keep current value selectable if it was set before categories loaded */}
                    {b.category && !categories.includes(b.category) && (
                      <option value={b.category}>{b.category}</option>
                    )}
                  </select>
                </td>
                <td className="gf-td-c">
                  <select className="gf-cell-select"
                    value={b.capex ? 'CAPEX' : 'OPEX'}
                    onChange={e => updateLine(b.id, { capex: e.target.value === 'CAPEX' })}>
                    <option value="CAPEX">CAPEX</option>
                    <option value="OPEX">OPEX</option>
                  </select>
                </td>
                <td className="gf-td-c">
                  <select className="gf-cell-select" value={b.currency}
                    onChange={e => updateLine(b.id, { currency: e.target.value })}>
                    {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                {years.map(y => (
                  <td key={y} className="gf-td-r">
                    <input className="gf-cell-input gf-cell-input--num"
                      value={b.values[y] ?? 0}
                      onChange={e => setYearValue(b.id, y, e.target.value)} />
                  </td>
                ))}
                <td className="gf-td-total">{fmtEur(lineTotal(b))}</td>
                <td>
                  <input className="gf-cell-input" value={b.note ?? ''} placeholder="Nota"
                    onChange={e => updateLine(b.id, { note: e.target.value || null })} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="gf-total-row">
              <td />
              <td colSpan={3 + years.length}>Total orçamentado</td>
              <td className="gf-td-r">{fmtEur(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

// ── ContractPanel ──────────────────────────────────────────────────
interface ContractPanelProps {
  form: ContractForm
  setForm: (form: ContractForm) => void
  onConfirm: () => void
  onClose: () => void
  panelErr: string | null
  currencies: string[]
}

function ContractPanel({ form, setForm, onConfirm, onClose, panelErr, currencies }: ContractPanelProps) {
  const set = (patch: Partial<ContractForm>) => setForm({ ...form, ...patch })
  return (
    <>
      <div className="gf-panel-overlay" onClick={onClose} />
      <div className="gf-panel">
        <div className="gf-panel-header">
          <span className="gf-panel-title">{form.id ? 'Editar Contrato' : 'Novo Contrato'}</span>
          <button className="gf-btn" onClick={onClose}>✕</button>
        </div>
        <div className="gf-panel-body">
          <div className="gf-field">
            <label className="gf-field-label">Fornecedor *</label>
            <input className="gf-field-input" value={form.supplier}
              onChange={e => set({ supplier: e.target.value })} placeholder="Nome do fornecedor" />
          </div>
          <div className="gf-field">
            <label className="gf-field-label">Categoria</label>
            <input className="gf-field-input" value={form.category}
              onChange={e => set({ category: e.target.value })} placeholder="Ex: Consultoria" />
          </div>
          <div className="gf-field-row">
            <div className="gf-field">
              <label className="gf-field-label">Valor Total *</label>
              <input className="gf-field-input" type="number" value={form.total_amount}
                onChange={e => set({ total_amount: e.target.value })} placeholder="0" />
            </div>
            <div className="gf-field">
              <label className="gf-field-label">Moeda</label>
              <select className="gf-field-select" value={form.currency}
                onChange={e => set({ currency: e.target.value })}>
                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="gf-field-row">
            <div className="gf-field">
              <label className="gf-field-label">Taxa p/ EUR</label>
              <input className="gf-field-input" type="number" value={form.exchange_rate_ref}
                onChange={e => set({ exchange_rate_ref: e.target.value })} placeholder="1.0" />
            </div>
            <div className="gf-field">
              <label className="gf-field-label">Data Adjudicação</label>
              <input className="gf-field-input" type="date" value={form.award_date}
                onChange={e => set({ award_date: e.target.value })} />
            </div>
          </div>
          <div className="gf-field">
            <label className="gf-field-label">Descrição</label>
            <textarea className="gf-field-textarea" value={form.description}
              onChange={e => set({ description: e.target.value })} placeholder="Objecto do contrato…" />
          </div>
        </div>
        <div className="gf-panel-footer">
          <button className="gf-btn gf-btn-save" onClick={onConfirm}>Confirmar</button>
          <button className="gf-btn" onClick={onClose}>Cancelar</button>
          {panelErr && <span className="gf-panel-err">{panelErr}</span>}
        </div>
      </div>
    </>
  )
}

// ── ContractsTab ───────────────────────────────────────────────────
interface ContractsTabProps {
  contracts: FinContract[]
  invoices: FinInvoice[]
  onEdit: (c: FinContract) => void
  onDelete: (id: string) => void
  onNew: () => void
}

function ContractsTab({ contracts, invoices, onEdit, onDelete, onNew }: ContractsTabProps) {
  const invoicedFor = useCallback((appContractId: string) =>
    invoices
      .filter(i => i.app_contract_id === appContractId)
      .reduce((s, i) => s + toEur(i.amount, i.exchange_rate), 0),
    [invoices])

  return (
    <div className="gf-contracts-wrap">
      <div className="gf-contracts-toolbar">
        <button className="gf-btn gf-btn-primary" onClick={onNew}>+ Novo Contrato</button>
      </div>
      {contracts.length === 0 ? (
        <div className="gf-empty">Sem contratos. Clique em + Novo Contrato para adicionar.</div>
      ) : (
        contracts.map(c => {
          const invoiced = invoicedFor(c.app_id)
          const totalEur = toEur(c.total_amount, c.exchange_rate_ref)
          const pct = totalEur > 0 ? Math.round((invoiced / totalEur) * 100) : 0
          return (
            <div key={c.id} className="gf-contract-card">
              <div className="gf-contract-header">
                <div style={{ flex: 1 }}>
                  <div className="gf-contract-title">{c.supplier || '(sem fornecedor)'}</div>
                  {c.category && <Badge variant="grey">{c.category}</Badge>}
                </div>
                <div className="gf-contract-actions">
                  <button className="gf-btn" onClick={() => onEdit(c)}>Editar</button>
                  <button className="gf-btn gf-btn-danger" onClick={() => onDelete(c.id)}>Eliminar</button>
                </div>
              </div>
              <div className="gf-contract-meta">
                <div className="gf-contract-meta-item">
                  <span className="gf-meta-label">Valor Total</span>
                  <span className="gf-meta-value" style={{ color: 'var(--navy)', fontWeight: 700 }}>
                    {fmtEur(totalEur)}{c.currency !== 'EUR' && ` (${c.currency})`}
                  </span>
                </div>
                {c.award_date && (
                  <div className="gf-contract-meta-item">
                    <span className="gf-meta-label">Adjudicação</span>
                    <span className="gf-meta-value">{c.award_date}</span>
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
                  <span>{fmtEur(invoiced)} / {fmtEur(totalEur)}</span>
                </div>
                <ProgressBar value={pct} color={pct > 100 ? 'red' : 'blue'} showLabel />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── InvoicesTab ────────────────────────────────────────────────────
interface InvoicesTabProps {
  invoices: FinInvoice[]
  setInvoices: (invoices: FinInvoice[]) => void
  onDelete: (id: string) => void
  currencies: string[]
  defaultCurrency: string
}

function InvoicesTab({ invoices, setInvoices, onDelete, currencies, defaultCurrency }: InvoicesTabProps) {
  const [statusFilter, setStatusFilter] = useState('Todos')

  const visible = useMemo(() =>
    statusFilter === 'Todos' ? invoices : invoices.filter(i => i.status === statusFilter),
    [invoices, statusFilter])

  const updateInv = (id: string, patch: Partial<FinInvoice>) =>
    setInvoices(invoices.map(i => i.id === id ? { ...i, ...patch } : i))

  const addRow = () =>
    setInvoices([...invoices, {
      id: newId(), pds_id: null, plano_id: null, contract_id: null, app_id: newAppId(), app_contract_id: '',
      program_id: null, ref: '', supplier: '', doc_type: 'Factura', description: null,
      amount: 0, currency: defaultCurrency, exchange_rate: null,
      issue_date: null, due_date: null, payment_date: null,
      status: 'Pendente', memo: null, sort_order: invoices.length,
    }])

  const duplicate = (id: string) => {
    const src = invoices.find(i => i.id === id)
    if (!src) return
    setInvoices([...invoices, { ...src, id: newId(), app_id: newAppId(), ref: src.ref + ' (cópia)', sort_order: invoices.length }])
  }

  const isOverdue = (inv: FinInvoice) =>
    !!inv.due_date && inv.due_date < TODAY && inv.status !== 'Paga' && inv.status !== 'Anulada'

  return (
    <div className="gf-invoices-wrap">
      <div className="gf-invoices-toolbar">
        <div className="gf-status-chips">
          {['Todos', ...INV_STATUSES].map(s => (
            <button key={s}
              className={`gf-chip${statusFilter === s ? ' gf-chip--active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >{s}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="gf-btn gf-btn-primary" onClick={addRow}>+ Factura</button>
      </div>

      <div className="gf-invoices-table-wrap">
        {visible.length === 0 ? (
          <div className="gf-empty" style={{ border: 'none' }}>
            {invoices.length === 0 ? 'Sem facturas.' : 'Nenhuma factura com este estado.'}
          </div>
        ) : (
          <table className="gf-invoices-table">
            <thead>
              <tr>
                <th style={{ width: 28 }} />
                <th style={{ width: 90 }}>Referência</th>
                <th style={{ width: 140 }}>Fornecedor</th>
                <th style={{ width: 86 }}>Tipo Doc.</th>
                <th className="gf-th-r" style={{ width: 100 }}>Montante</th>
                <th className="gf-th-c" style={{ width: 58 }}>Moeda</th>
                <th style={{ width: 112 }}>Emissão</th>
                <th style={{ width: 112 }}>Vencimento</th>
                <th style={{ width: 112 }}>Pagamento</th>
                <th style={{ width: 100 }}>Estado</th>
                <th style={{ width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map(inv => {
                const overdue = isOverdue(inv)
                return (
                  <tr key={inv.id} className={`gf-inv-row${overdue ? ' gf-inv-row--overdue' : ''}`}>
                    <td>
                      <button className="gf-icon-btn" onClick={() => onDelete(inv.id)} title="Remover">✕</button>
                    </td>
                    <td>
                      <input className="gf-cell-input" value={inv.ref}
                        onChange={e => updateInv(inv.id, { ref: e.target.value })} placeholder="Ref" />
                    </td>
                    <td>
                      <input className="gf-cell-input" value={inv.supplier}
                        onChange={e => updateInv(inv.id, { supplier: e.target.value })} placeholder="Fornecedor" />
                    </td>
                    <td>
                      <select className="gf-cell-select" value={inv.doc_type ?? 'Factura'}
                        onChange={e => updateInv(inv.id, { doc_type: e.target.value })}>
                        {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="gf-td-r">
                      <input className="gf-cell-input gf-cell-input--num" type="number" value={inv.amount}
                        onChange={e => updateInv(inv.id, { amount: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className="gf-td-c">
                      <select className="gf-cell-select" value={inv.currency}
                        onChange={e => updateInv(inv.id, { currency: e.target.value })}>
                        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      <input className="gf-cell-input" type="date" value={inv.issue_date ?? ''}
                        onChange={e => updateInv(inv.id, { issue_date: e.target.value || null })} />
                    </td>
                    <td>
                      <input className="gf-cell-input" type="date" value={inv.due_date ?? ''}
                        style={overdue ? { color: 'var(--red)', fontWeight: 700 } : {}}
                        onChange={e => updateInv(inv.id, { due_date: e.target.value || null })} />
                    </td>
                    <td>
                      <input className="gf-cell-input" type="date" value={inv.payment_date ?? ''}
                        onChange={e => updateInv(inv.id, { payment_date: e.target.value || null })} />
                    </td>
                    <td>
                      <select className="gf-cell-select" value={inv.status}
                        onChange={e => updateInv(inv.id, { status: e.target.value })}>
                        {INV_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="gf-icon-btn" onClick={() => duplicate(inv.id)} title="Duplicar"
                        style={{ color: 'var(--text2)', fontSize: 14 }}>⧉</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────
export default function GestaoFinanceira() {
  const { filters }  = useFilters()
  const { programs } = usePrograms()
  const [selProgId, setSelProgId] = useState<string>('')

  // Initialise from global filter or first available program (once)
  useEffect(() => {
    if (selProgId) return
    const init = filters.programIds[0] ?? programs[0]?.id
    if (init) setSelProgId(init)
  }, [programs]) // eslint-disable-line react-hooks/exhaustive-deps

  const programId = selProgId || undefined

  // ── Admin config: categories, currencies, management years ───
  const [categories,      setCategories]      = useState<string[]>([])
  const [currencies,      setCurrencies]      = useState<string[]>(CURRENCY_FALLBACK)
  const [defaultCurrency, setDefaultCurrency] = useState('EUR')
  const [managementYears, setManagementYears] = useState<string[]>([])

  // Currencies are global — fetch once on mount
  useEffect(() => {
    let cancelled = false
    supabase.from('currencies').select('code, is_default').order('code')
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return
        const rows = data as { code: string; is_default: boolean }[]
        setCurrencies(rows.map(r => r.code))
        const def = rows.find(r => r.is_default)
        if (def) setDefaultCurrency(def.code)
      })
    return () => { cancelled = true }
  }, [])

  // Categories and management years depend on the selected program
  useEffect(() => {
    if (!programId) {
      setCategories([])
      setManagementYears([])
      return
    }
    let cancelled = false

    Promise.all([
      // Step 1: get category IDs linked to this program, then fetch names
      supabase.from('cost_category_programs')
        .select('category_id')
        .eq('program_id', programId)
        .then(async ({ data: links }) => {
          if (!links || links.length === 0) return []
          const ids = (links as { category_id: string }[]).map(l => l.category_id)
          const { data: cats } = await supabase
            .from('cost_categories')
            .select('name')
            .in('id', ids)
            .order('name')
          return (cats ?? []).map((c: { name: string }) => c.name)
        }),
      // Step 2: get management years for this program
      supabase.from('management_years')
        .select('year')
        .eq('program_id', programId)
        .order('year')
        .then(({ data }) =>
          (data ?? []).map((y: { year: number }) => String(y.year))
        ),
    ]).then(([cats, years]) => {
      if (cancelled) return
      setCategories(cats)
      setManagementYears(years)
    })

    return () => { cancelled = true }
  }, [programId])
  const { planos, loading: planosLoading } = usePlanos(programId)
  const { budgetLines, contracts: dbContracts, invoices: dbInvoices, loading: finLoading } = useFinancials(programId)
  const loading = finLoading || planosLoading

  // ── Plan options from planos table ───────────────────────────
  const planOptions = useMemo<PlanOption[]>(() =>
    planos.map(p => {
      const eixoName = p.eixo?.name ?? ''
      return {
        key: p.id, label: eixoName ? `${eixoName} › ${p.name}` : p.name,
        n0: '', n1: eixoName, n2: p.name, id0: '', id1: p.eixo?.code ?? '', id2: p.code,
        program_id: p.program_id,
      }
    }),
    [planos]
  )

  const [selectedKey, setSelectedKey] = useState('')
  useEffect(() => { setSelectedKey('') }, [programId])
  useEffect(() => {
    if (!selectedKey && planOptions.length > 0) setSelectedKey(planOptions[0].key)
  }, [planOptions, selectedKey])

  const selectedPlan = useMemo(
    () => planOptions.find(p => p.key === selectedKey) ?? null,
    [planOptions, selectedKey])

  // ── Draft state ──────────────────────────────────────────────
  const [draft,    setDraft]    = useState<DraftState>(EMPTY_DRAFT)
  const [committed, setCommitted] = useState<DraftState>(EMPTY_DRAFT)
  const [deletedBudget,    setDeletedBudget]    = useState<Set<string>>(new Set())
  const [deletedContracts, setDeletedContracts] = useState<Set<string>>(new Set())
  const [deletedInvoices,  setDeletedInvoices]  = useState<Set<string>>(new Set())

  useEffect(() => {
    if (loading) return
    const pdsId = selectedPlan?.key
    const state: DraftState = {
      budget:    budgetLines.filter(b => b.plano_id === pdsId),
      contracts: dbContracts.filter(c => c.plano_id === pdsId),
      invoices:  dbInvoices.filter(i => i.plano_id === pdsId),
    }
    setDraft(state)
    setCommitted(state)
    setDeletedBudget(new Set())
    setDeletedContracts(new Set())
    setDeletedInvoices(new Set())
  // Re-run only when plan or loaded data changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan?.key, loading, budgetLines, dbContracts, dbInvoices])

  const isDirty = useMemo(() =>
    JSON.stringify(draft) !== JSON.stringify(committed) ||
    deletedBudget.size > 0 || deletedContracts.size > 0 || deletedInvoices.size > 0,
    [draft, committed, deletedBudget, deletedContracts, deletedInvoices])

  // ── Draft setters ────────────────────────────────────────────
  const setBudget    = useCallback((budget: FinBudgetLine[])   => setDraft(d => ({ ...d, budget })), [])
  const setContracts = useCallback((contracts: FinContract[])  => setDraft(d => ({ ...d, contracts })), [])
  const setInvoices  = useCallback((invoices: FinInvoice[])    => setDraft(d => ({ ...d, invoices })), [])

  const deleteBudget = useCallback((id: string) => {
    setDraft(d => ({ ...d, budget: d.budget.filter(b => b.id !== id) }))
    if (!isNew(id)) setDeletedBudget(prev => new Set([...prev, id]))
  }, [])

  const deleteContract = useCallback((id: string) => {
    setDraft(d => ({ ...d, contracts: d.contracts.filter(c => c.id !== id) }))
    if (!isNew(id)) setDeletedContracts(prev => new Set([...prev, id]))
  }, [])

  const deleteInvoice = useCallback((id: string) => {
    setDraft(d => ({ ...d, invoices: d.invoices.filter(i => i.id !== id) }))
    if (!isNew(id)) setDeletedInvoices(prev => new Set([...prev, id]))
  }, [])

  // ── Contract panel ───────────────────────────────────────────
  const [contractPanel, setContractPanel] = useState<ContractForm | null>(null)
  const [panelErr, setPanelErr] = useState<string | null>(null)

  const openNewContract = useCallback(() => {
    setPanelErr(null)
    setContractPanel({ ...BLANK_CONTRACT, currency: defaultCurrency })
  }, [defaultCurrency])

  const openEditContract = useCallback((c: FinContract) => {
    setPanelErr(null)
    setContractPanel({
      id: c.id, supplier: c.supplier, category: c.category,
      total_amount: String(c.total_amount), currency: c.currency,
      exchange_rate_ref: c.exchange_rate_ref != null ? String(c.exchange_rate_ref) : '',
      award_date: c.award_date ?? '', description: c.description ?? '',
    })
  }, [])

  const confirmContract = useCallback(() => {
    if (!contractPanel || !selectedPlan) return
    if (!contractPanel.supplier.trim()) { setPanelErr('Fornecedor obrigatório.'); return }
    const totalAmt = parseFloat(contractPanel.total_amount)
    if (isNaN(totalAmt) || totalAmt < 0) { setPanelErr('Valor inválido.'); return }
    const exRate = contractPanel.exchange_rate_ref !== '' ? parseFloat(contractPanel.exchange_rate_ref) : null
    const pdsId  = selectedPlan.key
    const progId = selectedPlan.program_id
    const appId  = newAppId()

    if (contractPanel.id) {
      const cid = contractPanel.id
      setDraft(d => ({
        ...d,
        contracts: d.contracts.map(c => c.id === cid ? {
          ...c,
          supplier:          contractPanel.supplier.trim(),
          category:          contractPanel.category,
          total_amount:      totalAmt,
          currency:          contractPanel.currency,
          exchange_rate_ref: exRate,
          award_date:        contractPanel.award_date || null,
          description:       contractPanel.description || null,
        } : c),
      }))
    } else {
      setDraft(d => ({
        ...d,
        contracts: [...d.contracts, {
          id: newId(), pds_id: null, plano_id: pdsId, app_id: appId, program_id: progId,
          supplier:          contractPanel.supplier.trim(),
          category:          contractPanel.category,
          total_amount:      totalAmt,
          currency:          contractPanel.currency,
          exchange_rate_ref: exRate,
          award_date:        contractPanel.award_date || null,
          description:       contractPanel.description || null,
          sort_order:        d.contracts.length,
        }],
      }))
    }
    setContractPanel(null)
  }, [contractPanel, selectedPlan])

  // ── Tab ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('orcamento')

  // ── KPIs ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const budgetTotal = draft.budget.reduce((s, b) => s + lineTotal(b), 0)
    const adjudicado  = draft.contracts.reduce((s, c) => s + toEur(c.total_amount, c.exchange_rate_ref), 0)
    const pago        = draft.invoices.filter(i => i.status === 'Paga').reduce((s, i) => s + toEur(i.amount, i.exchange_rate), 0)
    const emPagamento = draft.invoices.filter(i => i.status === 'Aprovado').reduce((s, i) => s + toEur(i.amount, i.exchange_rate), 0)
    return { budgetTotal, adjudicado, pago, emPagamento,
      porFacturar: adjudicado - pago - emPagamento,
      desvio:      adjudicado - budgetTotal }
  }, [draft])

  // ── Save ─────────────────────────────────────────────────────
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [toast,   setToast]   = useState(false)

  const handleSave = useCallback(async () => {
    if (saving || !selectedPlan || !isDirty) return
    setSaving(true)
    setSaveErr(null)

    const pdsId  = selectedPlan.key
    const progId = selectedPlan.program_id

    try {
      const existBudget    = draft.budget.filter(b => !isNew(b.id))
      const newBudget      = draft.budget.filter(b => isNew(b.id))
      const existContracts = draft.contracts.filter(c => !isNew(c.id))
      const newContracts   = draft.contracts.filter(c => isNew(c.id))
      const existInvoices  = draft.invoices.filter(i => !isNew(i.id))
      const newInvoices    = draft.invoices.filter(i => isNew(i.id))
      const delBudgetArr    = Array.from(deletedBudget)
      const delContractsArr = Array.from(deletedContracts)
      const delInvoicesArr  = Array.from(deletedInvoices)

      let insertedBudget:    FinBudgetLine[] = []
      let insertedContracts: FinContract[]   = []
      let insertedInvoices:  FinInvoice[]    = []

      const ops: Promise<unknown>[] = []

      // Upsert existing
      if (existBudget.length)
        ops.push(supabase.from('fin_budget_lines').upsert(
          existBudget.map(b => ({ id: b.id, plano_id: pdsId, app_id: b.app_id, program_id: progId,
            category: b.category, capex: b.capex, currency: b.currency,
            values: b.values, note: b.note, source_ref: b.source_ref, sort_order: b.sort_order })),
          { onConflict: 'id' }).then(r => { if (r.error) throw r.error }))

      if (existContracts.length)
        ops.push(supabase.from('fin_contracts').upsert(
          existContracts.map(c => ({ id: c.id, plano_id: pdsId, app_id: c.app_id, program_id: progId,
            supplier: c.supplier, category: c.category, currency: c.currency,
            exchange_rate_ref: c.exchange_rate_ref, total_amount: c.total_amount,
            award_date: c.award_date, description: c.description, sort_order: c.sort_order })),
          { onConflict: 'id' }).then(r => { if (r.error) throw r.error }))

      if (existInvoices.length)
        ops.push(supabase.from('fin_invoices').upsert(
          existInvoices.map(i => ({ id: i.id, plano_id: pdsId, contract_id: i.contract_id,
            app_id: i.app_id, app_contract_id: i.app_contract_id, program_id: progId,
            ref: i.ref, supplier: i.supplier, doc_type: i.doc_type, description: i.description,
            amount: i.amount, currency: i.currency, exchange_rate: i.exchange_rate,
            issue_date: i.issue_date, due_date: i.due_date, payment_date: i.payment_date,
            status: i.status, memo: i.memo, sort_order: i.sort_order })),
          { onConflict: 'id' }).then(r => { if (r.error) throw r.error }))

      // Deletes
      if (delBudgetArr.length)
        ops.push(supabase.from('fin_budget_lines').delete().in('id', delBudgetArr).then(r => { if (r.error) throw r.error }))
      if (delContractsArr.length)
        ops.push(supabase.from('fin_contracts').delete().in('id', delContractsArr).then(r => { if (r.error) throw r.error }))
      if (delInvoicesArr.length)
        ops.push(supabase.from('fin_invoices').delete().in('id', delInvoicesArr).then(r => { if (r.error) throw r.error }))

      // Inserts (need back real IDs)
      if (newBudget.length)
        ops.push(supabase.from('fin_budget_lines').insert(
          newBudget.map((b, idx) => ({ plano_id: pdsId, app_id: b.app_id, program_id: progId,
            category: b.category, capex: b.capex, currency: b.currency,
            values: b.values, note: b.note, source_ref: b.source_ref,
            sort_order: existBudget.length + idx }))).select()
          .then(r => { if (r.error) throw r.error; insertedBudget = (r.data ?? []) as FinBudgetLine[] }))

      if (newContracts.length)
        ops.push(supabase.from('fin_contracts').insert(
          newContracts.map((c, idx) => ({ plano_id: pdsId, app_id: c.app_id, program_id: progId,
            supplier: c.supplier, category: c.category, currency: c.currency,
            exchange_rate_ref: c.exchange_rate_ref, total_amount: c.total_amount,
            award_date: c.award_date, description: c.description,
            sort_order: existContracts.length + idx }))).select()
          .then(r => { if (r.error) throw r.error; insertedContracts = (r.data ?? []) as FinContract[] }))

      if (newInvoices.length)
        ops.push(supabase.from('fin_invoices').insert(
          newInvoices.map((i, idx) => ({ plano_id: pdsId, contract_id: i.contract_id,
            app_id: i.app_id, app_contract_id: i.app_contract_id, program_id: progId,
            ref: i.ref, supplier: i.supplier, doc_type: i.doc_type, description: i.description,
            amount: i.amount, currency: i.currency, exchange_rate: i.exchange_rate,
            issue_date: i.issue_date, due_date: i.due_date, payment_date: i.payment_date,
            status: i.status, memo: i.memo, sort_order: existInvoices.length + idx }))).select()
          .then(r => { if (r.error) throw r.error; insertedInvoices = (r.data ?? []) as FinInvoice[] }))

      console.log('[GestaoFinanceira] save payload:', {
        plano_id: pdsId, program_id: progId,
        existBudget: existBudget.length, newBudget: newBudget.length,
        existContracts: existContracts.length, newContracts: newContracts.length,
        existInvoices: existInvoices.length, newInvoices: newInvoices.length,
        delBudget: delBudgetArr.length, delContracts: delContractsArr.length, delInvoices: delInvoicesArr.length,
      })
      await Promise.all(ops)
      console.log('[GestaoFinanceira] save result: success')

      // Patch draft with server IDs
      const finalBudget    = [...existBudget, ...newBudget.map((b, i) => insertedBudget[i] ?? b)]
      const finalContracts = [...existContracts, ...newContracts.map((c, i) => insertedContracts[i] ?? c)]
      const finalInvoices  = [...existInvoices, ...newInvoices.map((inv, i) => insertedInvoices[i] ?? inv)]

      const finalDraft: DraftState = { budget: finalBudget, contracts: finalContracts, invoices: finalInvoices }
      setDraft(finalDraft)
      setCommitted(finalDraft)
      setDeletedBudget(new Set())
      setDeletedContracts(new Set())
      setDeletedInvoices(new Set())
      setToast(true)
      setTimeout(() => setToast(false), 2000)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }, [saving, selectedPlan, isDirty, draft, deletedBudget, deletedContracts, deletedInvoices])

  // ── Render ───────────────────────────────────────────────────
  const noProgram = !programId
  const noPlans   = !noProgram && !planosLoading && planOptions.length === 0

  return (
    <div className="gf-page">
      {/* Controls bar */}
      <div className="gf-controls-bar">
        {programs.length > 1 && (
          <>
            <label className="gf-label">Programa:</label>
            <select
              className="gf-plan-select"
              value={selProgId}
              onChange={e => { setSelProgId(e.target.value); setSelectedKey('') }}
            >
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>
        )}
        <label className="gf-label">Plano de Acção:</label>
        <select
          className="gf-plan-select"
          value={selectedKey}
          onChange={e => setSelectedKey(e.target.value)}
          disabled={noProgram || noPlans}
        >
          {noProgram  ? <option value="">— selecciona um programa —</option>
           : noPlans  ? <option value="">— sem planos disponíveis —</option>
           : planOptions.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <div className="gf-spacer" />
        {saveErr && <span className="gf-save-err">{saveErr}</span>}
        {toast   && <span className="gf-toast">Guardado!</span>}
        <button
          className="gf-btn gf-btn-save"
          onClick={handleSave}
          disabled={!selectedPlan || !isDirty || saving}
        >
          {saving ? 'A guardar…' : isDirty ? 'Guardar alterações' : 'Guardar'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>A carregar…</div>
      ) : noProgram ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Selecciona um programa para visualizar as finanças.
        </div>
      ) : noPlans ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Nenhum plano de acção disponível para este programa.
        </div>
      ) : !selectedPlan ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Selecciona um plano de acção.
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="gf-kpi-row">
            <KpiCard label="Orçamento Total"  value={fmtEur(kpis.budgetTotal)}  color="navy" />
            <KpiCard label="Adjudicado"        value={fmtEur(kpis.adjudicado)}  color="blue" />
            <KpiCard label="Pago"              value={fmtEur(kpis.pago)}         color="green" />
            <KpiCard label="Em Pagamento"      value={fmtEur(kpis.emPagamento)} color="amber" />
            <KpiCard label="Por Facturar"      value={fmtEur(Math.max(0, kpis.porFacturar))} color="text" />
            <KpiCard
              label="Desvio"
              value={fmtEur(Math.abs(kpis.desvio))}
              subtitle={kpis.desvio > 0 ? 'acima do orçamento' : kpis.desvio < 0 ? 'dentro do orçamento' : ''}
              color={kpis.desvio > 0 ? 'red' : 'green'}
            />
          </div>

          {/* Tabs */}
          <div className="gf-tabs">
            {([['orcamento', 'Orçamento'], ['contratos', 'Contratos'], ['facturas', 'Facturas']] as [Tab, string][]).map(([t, lbl]) => (
              <button key={t} className={`gf-tab${tab === t ? ' gf-tab--active' : ''}`}
                onClick={() => setTab(t)}>{lbl}</button>
            ))}
          </div>

          {tab === 'orcamento' && (
            <BudgetTab
              lines={draft.budget}
              setLines={setBudget}
              onDelete={deleteBudget}
              categories={categories}
              currencies={currencies}
              defaultCurrency={defaultCurrency}
              managementYears={managementYears}
            />
          )}
          {tab === 'contratos' && (
            <ContractsTab
              contracts={draft.contracts}
              invoices={draft.invoices}
              onEdit={openEditContract}
              onDelete={deleteContract}
              onNew={openNewContract}
            />
          )}
          {tab === 'facturas' && (
            <InvoicesTab
              invoices={draft.invoices}
              setInvoices={setInvoices}
              onDelete={deleteInvoice}
              currencies={currencies}
              defaultCurrency={defaultCurrency}
            />
          )}
        </>
      )}

      {contractPanel && (
        <ContractPanel
          form={contractPanel}
          setForm={f => setContractPanel(f)}
          onConfirm={confirmContract}
          onClose={() => setContractPanel(null)}
          panelErr={panelErr}
          currencies={currencies}
        />
      )}
    </div>
  )
}
