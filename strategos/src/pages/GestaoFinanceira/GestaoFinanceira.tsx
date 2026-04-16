import './GestaoFinanceira.css'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useFilters } from '../../context/FilterContext'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import { useFinancials } from '../../hooks/useFinancials'
import KpiCard from '../../components/KpiCard/KpiCard'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import Badge from '../../components/Badge/Badge'
import Modal from '../../components/Modal/Modal'
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
  end_date: string
  description: string
}

// ── Constants ──────────────────────────────────────────────────────
interface CurrencyOption { code: string; symbol: string }
interface CategoryOption { name: string; is_capex: boolean }

const EMPTY_DRAFT: DraftState = { budget: [], contracts: [], invoices: [] }

const BLANK_CONTRACT: ContractForm = {
  id: null, supplier: '', category: '', total_amount: '',
  currency: 'EUR', exchange_rate_ref: '', award_date: '', end_date: '', description: '',
}

interface InvoiceForm {
  id: string | null
  ref: string
  supplier: string
  app_contract_id: string
  doc_type: string
  amount: string
  currency: string
  exchange_rate: string
  issue_date: string
  due_date: string
  payment_date: string
  status: string
}

const CURRENCY_FALLBACK: CurrencyOption[] = [
  { code: 'EUR', symbol: '€' }, { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' }, { code: 'CHF', symbol: 'CHF' },
  { code: 'AOA', symbol: 'Kz' }, { code: 'MZN', symbol: 'MT' },
]
const DOC_TYPES    = ['Factura', 'Recibo', 'Nota de Crédito', 'Pró-forma', 'Outro']
const INV_STATUSES = ['Pendente', 'Aprovado', 'Paga', 'Anulada']
const TODAY = new Date().toISOString().slice(0, 10)

// ── Helpers ────────────────────────────────────────────────────────
let _seq = 0
function newId(): string { return 'new_' + (++_seq) + '_' + Math.random().toString(36).slice(2, 6) }
function newAppId(): string { return 'gf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }
function isNew(id: string): boolean { return id.startsWith('new_') }
function toEur(amount: number, rate: number | null): number { return amount * (rate ?? 1) }
function fmtEur(n: number, symbol = '€'): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ' + symbol
}
function lineTotal(b: FinBudgetLine): number {
  return Object.values(b.values).reduce((s, v) => s + v, 0)
}
function fmtDate(d: string | null): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// ── BudgetTab ──────────────────────────────────────────────────────
interface BudgetTabProps {
  lines: FinBudgetLine[]
  setLines: (lines: FinBudgetLine[]) => void
  onDelete: (id: string) => void
  onSaveLine: (b: FinBudgetLine) => void
  savedRows: Set<string>
  /** Categories (with is_capex) configured in Admin → Financeiro for this program */
  categories: CategoryOption[]
  /** Currencies (with symbol) from the currencies table */
  currencies: CurrencyOption[]
  /** Default currency code (is_default = true) */
  defaultCurrency: string
  /** Management years configured in Admin → Financeiro for this program */
  managementYears: string[]
}

function BudgetTab({ lines, setLines, onDelete, onSaveLine, savedRows, categories, currencies, defaultCurrency, managementYears }: BudgetTabProps) {
  // Seed from management_years; merge with any year keys already on lines
  const years = useMemo(() => {
    const ks = new Set<string>(managementYears)
    lines.forEach(b => Object.keys(b.values).forEach(k => ks.add(k)))
    return Array.from(ks).sort()
  }, [lines, managementYears])

  // code → symbol lookup for the Total column
  const currSymbolMap = useMemo(
    () => new Map(currencies.map(c => [c.code, c.symbol || '€'])),
    [currencies],
  )

  const updateLine = (id: string, patch: Partial<FinBudgetLine>) =>
    setLines(lines.map(b => b.id === id ? { ...b, ...patch } : b))

  const setYearValue = (id: string, year: string, val: string) => {
    const num = parseFloat(val.replace(',', '.')) || 0
    setLines(lines.map(b => b.id === id ? { ...b, values: { ...b.values, [year]: num } } : b))
  }

  // Keep removeYear so users can hide a column; adding new years is done in Admin
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

  const yearTotals = useMemo(() => {
    const t: Record<string, number> = {}
    years.forEach(y => { t[y] = 0 })
    lines.forEach(b => years.forEach(y => { t[y] = (t[y] ?? 0) + (b.values[y] ?? 0) }))
    return t
  }, [lines, years])

  // Symbol for the grand-total row: most-common currency among lines, or defaultCurrency
  const totalSymbol = useMemo(() => {
    if (lines.length === 0) return currSymbolMap.get(defaultCurrency) ?? '€'
    const counts: Record<string, number> = {}
    lines.forEach(b => { counts[b.currency] = (counts[b.currency] ?? 0) + 1 })
    const topCode = Object.entries(counts).sort((a, z) => z[1] - a[1])[0]?.[0]
    return currSymbolMap.get(topCode ?? defaultCurrency) ?? currSymbolMap.get(defaultCurrency) ?? '€'
  }, [lines, currSymbolMap, defaultCurrency])

  return (
    <div className="gf-budget-wrap">
      <div className="gf-budget-toolbar">
        <span className="gf-budget-toolbar-title">Rubricas Orçamentais</span>
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
              <tr key={b.id} style={savedRows.has(b.id) ? { boxShadow: 'inset 0 0 0 2px #95BB42' } : undefined}>
                <td>
                  <button className="gf-icon-btn" onClick={() => onDelete(b.id)} title="Remover">✕</button>
                </td>
                <td>
                  <select className="gf-cell-select" value={b.category}
                    onChange={e => {
                      const name = e.target.value
                      const cat = categories.find(c => c.name === name)
                      const patch: Partial<FinBudgetLine> = { category: name }
                      if (cat != null) patch.capex = Boolean(cat.is_capex)
                      updateLine(b.id, patch)
                      onSaveLine({ ...b, ...patch })
                    }}>
                    <option value="">— categoria —</option>
                    {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    {/* Keep current value selectable if it was set before categories loaded */}
                    {b.category && !categories.some(c => c.name === b.category) && (
                      <option value={b.category}>{b.category}</option>
                    )}
                  </select>
                </td>
                <td className="gf-td-c">
                  {b.category
                    ? <span style={{
                        display: 'inline-block', padding: '3px 9px', borderRadius: 999,
                        fontSize: 11, fontWeight: 500,
                        background: b.capex ? '#EBF0FA' : '#FDF3E7',
                        color: b.capex ? 'var(--blue)' : 'var(--amber)',
                      }}>{b.capex ? 'CAPEX' : 'OPEX'}</span>
                    : <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>}
                </td>
                <td className="gf-td-c">
                  <select className="gf-cell-select" value={b.currency}
                    onChange={e => {
                      const val = e.target.value
                      updateLine(b.id, { currency: val })
                      onSaveLine({ ...b, currency: val })
                    }}>
                    {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </td>
                {years.map(y => (
                  <td key={y} className="gf-td-r">
                    <input className="gf-cell-input gf-cell-input--num"
                      value={b.values[y] ?? 0}
                      onChange={e => setYearValue(b.id, y, e.target.value)}
                      onBlur={e => onSaveLine({ ...b, values: { ...b.values, [y]: parseFloat(e.target.value.replace(',', '.')) || 0 } })} />
                  </td>
                ))}
                <td className="gf-td-total">{fmtEur(lineTotal(b), currSymbolMap.get(b.currency) ?? '€')}</td>
                <td>
                  <input className="gf-cell-input" value={b.note ?? ''} placeholder="Nota"
                    onChange={e => updateLine(b.id, { note: e.target.value || null })}
                    onBlur={e => onSaveLine({ ...b, note: e.target.value || null })} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="gf-total-row">
              <td />
              <td colSpan={3}>Total orçamentado</td>
              {years.map(y => (
                <td key={y} className="gf-td-r">{fmtEur(yearTotals[y] ?? 0, totalSymbol)}</td>
              ))}
              <td className="gf-td-r">{fmtEur(total, totalSymbol)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

// ── ContractModalBody ──────────────────────────────────────────────
function ContractModalBody({ form, setForm, currencies, categories }: {
  form: ContractForm
  setForm: (f: ContractForm) => void
  currencies: CurrencyOption[]
  categories: CategoryOption[]
}) {
  const set = (patch: Partial<ContractForm>) => setForm({ ...form, ...patch })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="gf-field">
        <label className="gf-field-label">Fornecedor *</label>
        <input className="gf-field-input" value={form.supplier}
          onChange={e => set({ supplier: e.target.value })} placeholder="Nome do fornecedor" />
      </div>
      <div className="gf-field">
        <label className="gf-field-label">Categoria</label>
        <select className="gf-field-select" value={form.category}
          onChange={e => set({ category: e.target.value })}>
          <option value="">— categoria —</option>
          {categories.map(cat => (
            <option key={cat.name} value={cat.name}>{cat.name}</option>
          ))}
        </select>
      </div>
      <div className="gf-field">
        <label className="gf-field-label">Descrição</label>
        <textarea className="gf-field-textarea" value={form.description}
          onChange={e => set({ description: e.target.value })} placeholder="Objecto do contrato…" />
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
            {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
      </div>
      <div className="gf-field-row">
        <div className="gf-field">
          <label className="gf-field-label">Taxa Câmbio</label>
          <input className="gf-field-input" type="number" value={form.exchange_rate_ref}
            onChange={e => set({ exchange_rate_ref: e.target.value })} placeholder="1.0" />
        </div>
        <div className="gf-field">
          <label className="gf-field-label">Data Adjudicação</label>
          <input className="gf-field-input" type="date" value={form.award_date}
            onChange={e => set({ award_date: e.target.value })} />
        </div>
      </div>
      <div className="gf-field-row">
        <div className="gf-field">
          <label className="gf-field-label">Data Fim</label>
          <input className="gf-field-input" type="date" value={form.end_date}
            onChange={e => set({ end_date: e.target.value })} />
        </div>
        <div className="gf-field" />
      </div>
    </div>
  )
}

// ── ContractsTab ───────────────────────────────────────────────────
interface ContractsTabProps {
  contracts: FinContract[]
  invoices: FinInvoice[]
  onEdit: (c: FinContract) => void
  onDelete: (id: string) => void
  onNew: () => void
  currencies: CurrencyOption[]
}

function ContractsTab({ contracts, invoices, onEdit, onDelete, onNew, currencies }: ContractsTabProps) {
  const invoicedFor = useCallback((c: FinContract) =>
    invoices
      .filter(i => i.app_contract_id === c.app_id || i.contract_id === c.id)
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
          const sym = currencies.find(cur => cur.code === c.currency)?.symbol ?? '€'
          const invoicedEur = invoicedFor(c)
          const totalEur = toEur(c.total_amount, c.exchange_rate_ref)
          const nativeInvoiced = c.exchange_rate_ref ? invoicedEur / c.exchange_rate_ref : invoicedEur
          const pct = totalEur > 0 ? Math.round((invoicedEur / totalEur) * 100) : 0
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
  )
}

// ── InvoiceModalBody ───────────────────────────────────────────────
function InvoiceModalBody({ form, setForm, contracts, currencies, supplierFilter, setSupplierFilter }: {
  form: InvoiceForm
  setForm: (f: InvoiceForm) => void
  contracts: FinContract[]
  currencies: CurrencyOption[]
  supplierFilter: string
  setSupplierFilter: (s: string) => void
}) {
  const set = (patch: Partial<InvoiceForm>) => setForm({ ...form, ...patch })

  const suppliers = useMemo(() => {
    const seen = new Set(contracts.map(c => c.supplier).filter(Boolean))
    return Array.from(seen).sort()
  }, [contracts])

  const filteredContracts = supplierFilter
    ? contracts.filter(c => c.supplier === supplierFilter)
    : contracts

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="gf-field-row">
        <div className="gf-field">
          <label className="gf-field-label">Fornecedor</label>
          <select className="gf-field-select" value={supplierFilter}
            onChange={e => {
              setSupplierFilter(e.target.value)
              set({ app_contract_id: '', supplier: e.target.value })
            }}>
            <option value="">— fornecedor —</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="gf-field">
          <label className="gf-field-label">Contrato</label>
          <select className="gf-field-select" value={form.app_contract_id}
            onChange={e => {
              const c = contracts.find(x => x.app_id === e.target.value)
              set({ app_contract_id: e.target.value, ...(c ? { supplier: c.supplier } : {}) })
            }}
            disabled={!supplierFilter}>
            <option value="">— contrato —</option>
            {filteredContracts.map(c => (
              <option key={c.app_id} value={c.app_id}>{c.description || c.supplier}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="gf-field-row">
        <div className="gf-field">
          <label className="gf-field-label">Referência</label>
          <input className="gf-field-input" value={form.ref}
            onChange={e => set({ ref: e.target.value })} placeholder="Nº da factura" />
        </div>
        <div className="gf-field">
          <label className="gf-field-label">Tipo Doc.</label>
          <select className="gf-field-select" value={form.doc_type}
            onChange={e => set({ doc_type: e.target.value })}>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="gf-field-row">
        <div className="gf-field">
          <label className="gf-field-label">Montante *</label>
          <input className="gf-field-input" type="number" value={form.amount}
            onChange={e => set({ amount: e.target.value })} placeholder="0" />
        </div>
        <div className="gf-field">
          <label className="gf-field-label">Moeda</label>
          <select className="gf-field-select" value={form.currency}
            onChange={e => set({ currency: e.target.value })}>
            {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
      </div>
      <div className="gf-field-row">
        <div className="gf-field">
          <label className="gf-field-label">Data Emissão</label>
          <input className="gf-field-input" type="date" value={form.issue_date}
            onChange={e => set({ issue_date: e.target.value })} />
        </div>
        <div className="gf-field">
          <label className="gf-field-label">Data Vencimento</label>
          <input className="gf-field-input" type="date" value={form.due_date}
            onChange={e => set({ due_date: e.target.value })} />
        </div>
      </div>
      <div className="gf-field-row">
        <div className="gf-field">
          <label className="gf-field-label">Data Pagamento</label>
          <input className="gf-field-input" type="date" value={form.payment_date}
            onChange={e => set({ payment_date: e.target.value })} />
        </div>
        <div className="gf-field">
          <label className="gf-field-label">Estado</label>
          <select className="gf-field-select" value={form.status}
            onChange={e => set({ status: e.target.value })}>
            {INV_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ── ⋯ Invoice row menu ────────────────────────────────────────────
const INV_MENU_H = 120 // 3 items × ~34px + 8px padding

interface InvRowMenuProps {
  invId: string
  openId: string | null
  onOpen: (id: string | null) => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function InvRowMenu({ invId, openId, onOpen, onEdit, onDuplicate, onDelete }: InvRowMenuProps) {
  const open   = openId === invId
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect       = btnRef.current.getBoundingClientRect()
      const right      = window.innerWidth - rect.right
      const spaceBelow = window.innerHeight - rect.bottom
      setPos(spaceBelow >= INV_MENU_H
        ? { top: rect.bottom + 4, right }
        : { bottom: window.innerHeight - rect.top + 4, right }
      )
    }
    onOpen(open ? null : invId)
  }

  const menu = (
    <div
      className="gf-inv-menu"
      style={{ position: 'fixed', zIndex: 300, ...(pos ?? {}) }}
      onClick={e => e.stopPropagation()}
    >
      <button className="gf-inv-menu-item" onClick={() => { onOpen(null); onEdit() }}>Editar</button>
      <button className="gf-inv-menu-item" onClick={() => { onOpen(null); onDuplicate() }}>Duplicar</button>
      <button className="gf-inv-menu-item danger" onClick={() => {
        onOpen(null)
        if (window.confirm('Eliminar esta factura?')) onDelete()
      }}>Eliminar</button>
    </div>
  )

  return (
    <>
      <button ref={btnRef} className="gf-menu-btn" onClick={handleClick} title="Acções">⋯</button>
      {open && pos !== null && createPortal(menu, document.body)}
    </>
  )
}

// ── InvoicesTab ────────────────────────────────────────────────────
interface InvoicesTabProps {
  invoices: FinInvoice[]
  onNew: () => void
  onEdit: (inv: FinInvoice) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  contracts: FinContract[]
  currencies: CurrencyOption[]
}

const INV_STATUS_COLOR: Record<string, string> = {
  'Pendente':  'var(--text2)',
  'Aprovado':  'var(--blue)',
  'Paga':      'var(--green)',
  'Anulada':   'var(--text3)',
}

function InvoicesTab({ invoices, onNew, onEdit, onDelete, onDuplicate, contracts, currencies }: InvoicesTabProps) {
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [openMenuId,   setOpenMenuId]   = useState<string | null>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return
    const handler = () => setOpenMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [openMenuId])

  const visible = useMemo(() =>
    statusFilter === 'Todos' ? invoices : invoices.filter(i => i.status === statusFilter),
    [invoices, statusFilter])

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
        <button className="gf-btn gf-btn-primary" onClick={onNew}>+ Factura</button>
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
                <th style={{ width: 100 }}>Referência</th>
                <th style={{ width: 140 }}>Fornecedor</th>
                <th style={{ width: 160 }}>Contrato</th>
                <th style={{ width: 86 }}>Tipo Doc.</th>
                <th className="gf-th-r" style={{ width: 120 }}>Montante</th>
                <th style={{ width: 90 }}>Emissão</th>
                <th style={{ width: 90 }}>Vencimento</th>
                <th style={{ width: 90 }}>Pagamento</th>
                <th style={{ width: 80 }}>Estado</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map(inv => {
                const overdue = isOverdue(inv)
                const sym = currencies.find(c => c.code === inv.currency)?.symbol ?? '€'
                const linked = contracts.find(c => c.app_id === inv.app_contract_id || c.id === inv.contract_id)
                return (
                  <tr key={inv.id} className={`gf-inv-row${overdue ? ' gf-inv-row--overdue' : ''}`}>
                    <td className="gf-td-wrap">{inv.ref || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td className="gf-td-wrap">{inv.supplier || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td className="gf-td-wrap" style={{ color: 'var(--text2)', fontSize: 12 }}>
                      {linked ? (linked.description || linked.supplier) : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{inv.doc_type ?? '—'}</td>
                    <td className="gf-td-r">{fmtEur(inv.amount, sym)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(inv.issue_date)}</td>
                    <td style={{ fontSize: 12, color: overdue ? 'var(--red)' : 'var(--text2)', fontWeight: overdue ? 700 : undefined }}>
                      {fmtDate(inv.due_date)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(inv.payment_date)}</td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 600, color: INV_STATUS_COLOR[inv.status] ?? 'var(--text2)' }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <InvRowMenu
                        invId={inv.id}
                        openId={openMenuId}
                        onOpen={setOpenMenuId}
                        onEdit={() => onEdit(inv)}
                        onDuplicate={() => onDuplicate(inv.id)}
                        onDelete={() => onDelete(inv.id)}
                      />
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
  const [categories,      setCategories]      = useState<CategoryOption[]>([])
  const [currencies,      setCurrencies]      = useState<CurrencyOption[]>(CURRENCY_FALLBACK)
  const [defaultCurrency, setDefaultCurrency] = useState('EUR')
  const [managementYears, setManagementYears] = useState<string[]>([])

  // Currencies are global — fetch once on mount
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
            .select('name, is_capex')
            .in('id', ids)
            .order('name')
          return (cats ?? []).map((c: { name: string; is_capex: boolean }) => ({ name: c.name, is_capex: c.is_capex }))
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
    if (planOptions.length === 0) return
    if (planOptions.some(p => p.key === selectedKey)) return
    setSelectedKey(planOptions[0].key)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planOptions])

  const selectedPlan = useMemo(
    () => planOptions.find(p => p.key === selectedKey) ?? null,
    [planOptions, selectedKey])

  // ── Draft state ──────────────────────────────────────────────
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)

  // ── Budget auto-save state ───────────────────────────────────
  const [rowSaved,    setRowSaved]    = useState<Set<string>>(new Set())
  const savingRowsRef = useRef<Set<string>>(new Set())
  const [errToast,    setErrToast]    = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    const pdsId = selectedPlan?.key
    const state: DraftState = {
      budget:    budgetLines.filter(b => b.plano_id === pdsId),
      contracts: dbContracts.filter(c => c.plano_id === pdsId),
      invoices:  dbInvoices.filter(i => i.plano_id === pdsId),
    }
    setDraft(state)
    setRowSaved(new Set())
  // Re-run only when plan or loaded data changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan?.key, loading, budgetLines, dbContracts, dbInvoices])

  // ── Draft setters ────────────────────────────────────────────
  const setBudget    = useCallback((budget: FinBudgetLine[])   => setDraft(d => ({ ...d, budget })), [])
  const setContracts = useCallback((contracts: FinContract[])  => setDraft(d => ({ ...d, contracts })), [])
  const setInvoices  = useCallback((invoices: FinInvoice[])    => setDraft(d => ({ ...d, invoices })), [])

  const deleteBudget = useCallback((id: string) => {
    setDraft(d => ({ ...d, budget: d.budget.filter(b => b.id !== id) }))
    if (!isNew(id)) {
      supabase.from('fin_budget_lines').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Delete budget line failed', error) })
    }
  }, [])

  const deleteContract = useCallback((id: string) => {
    setDraft(d => ({ ...d, contracts: d.contracts.filter(c => c.id !== id) }))
  }, [])

  const deleteInvoice = useCallback((id: string) => {
    setDraft(d => ({ ...d, invoices: d.invoices.filter(i => i.id !== id) }))
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
      award_date: c.award_date ?? '', end_date: c.end_date ?? '', description: c.description ?? '',
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
          end_date:          contractPanel.end_date || null,
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
          end_date:          contractPanel.end_date || null,
          description:       contractPanel.description || null,
          sort_order:        d.contracts.length,
        }],
      }))
    }
    setContractPanel(null)
  }, [contractPanel, selectedPlan])

  // ── Invoice modal ────────────────────────────────────────────
  const [invoiceModal,          setInvoiceModal]          = useState<InvoiceForm | null>(null)
  const [invModalErr,           setInvModalErr]           = useState<string | null>(null)
  const [invModalSupplierFilter, setInvModalSupplierFilter] = useState('')

  const openNewInvoice = useCallback(() => {
    setInvModalErr(null)
    setInvModalSupplierFilter('')
    setInvoiceModal({
      id: null, ref: '', supplier: '', app_contract_id: '',
      doc_type: 'Factura', amount: '', currency: defaultCurrency, exchange_rate: '',
      issue_date: '', due_date: '', payment_date: '', status: 'Pendente',
    })
  }, [defaultCurrency])

  const openEditInvoice = useCallback((inv: FinInvoice) => {
    setInvModalErr(null)
    setInvModalSupplierFilter(inv.supplier ?? '')
    setInvoiceModal({
      id: inv.id, ref: inv.ref, supplier: inv.supplier,
      app_contract_id: inv.app_contract_id,
      doc_type: inv.doc_type ?? 'Factura',
      amount: String(inv.amount),
      currency: inv.currency,
      exchange_rate: inv.exchange_rate != null ? String(inv.exchange_rate) : '',
      issue_date: inv.issue_date ?? '', due_date: inv.due_date ?? '',
      payment_date: inv.payment_date ?? '', status: inv.status,
    })
  }, [])

  const confirmInvoice = useCallback(() => {
    if (!invoiceModal || !selectedPlan) return
    const amount = parseFloat(invoiceModal.amount)
    if (isNaN(amount) || amount < 0) { setInvModalErr('Montante inválido.'); return }
    const exRate = invoiceModal.exchange_rate !== '' ? parseFloat(invoiceModal.exchange_rate) : null
    const pdsId  = selectedPlan.key
    const progId = selectedPlan.program_id

    if (invoiceModal.id) {
      const iid = invoiceModal.id
      setDraft(d => ({
        ...d,
        invoices: d.invoices.map(i => i.id === iid ? {
          ...i,
          ref:              invoiceModal.ref,
          supplier:         invoiceModal.supplier,
          app_contract_id:  invoiceModal.app_contract_id,
          contract_id:      d.contracts.find(c => c.app_id === invoiceModal!.app_contract_id)?.id ?? null,
          doc_type:         invoiceModal.doc_type,
          amount,
          currency:         invoiceModal.currency,
          exchange_rate:    exRate,
          issue_date:       invoiceModal.issue_date || null,
          due_date:         invoiceModal.due_date || null,
          payment_date:     invoiceModal.payment_date || null,
          status:           invoiceModal.status,
        } : i),
      }))
    } else {
      setDraft(d => ({
        ...d,
        invoices: [...d.invoices, {
          id: newId(), pds_id: null, plano_id: pdsId,
          contract_id: d.contracts.find(c => c.app_id === invoiceModal!.app_contract_id)?.id ?? null,
          app_id: newAppId(), app_contract_id: invoiceModal.app_contract_id,
          program_id: progId,
          ref:           invoiceModal.ref,
          supplier:      invoiceModal.supplier,
          doc_type:      invoiceModal.doc_type,
          description:   null,
          amount,
          currency:      invoiceModal.currency,
          exchange_rate: exRate,
          issue_date:    invoiceModal.issue_date || null,
          due_date:      invoiceModal.due_date || null,
          payment_date:  invoiceModal.payment_date || null,
          status:        invoiceModal.status,
          memo:          null,
          sort_order:    d.invoices.length,
        }],
      }))
    }
    setInvoiceModal(null)
  }, [invoiceModal, selectedPlan])

  const deleteInvoiceFromModal = useCallback(() => {
    if (!invoiceModal?.id) return
    deleteInvoice(invoiceModal.id)
    setInvoiceModal(null)
  }, [invoiceModal, deleteInvoice])

  const duplicateInvoice = useCallback((id: string) => {
    setDraft(d => {
      const src = d.invoices.find(i => i.id === id)
      if (!src) return d
      return { ...d, invoices: [...d.invoices, {
        ...src, id: newId(), app_id: newAppId(),
        ref: src.ref + ' (cópia)', sort_order: d.invoices.length,
      }] }
    })
  }, [])

  // Symbol for the default currency — used in KPI cards
  const defaultSymbol = useMemo(
    () => currencies.find(c => c.code === defaultCurrency)?.symbol ?? '€',
    [currencies, defaultCurrency],
  )

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

  // ── Budget line auto-save ─────────────────────────────────────
  const saveBudgetLine = useCallback(async (b: FinBudgetLine) => {
    const key = b.id
    if (savingRowsRef.current.has(key)) return
    savingRowsRef.current.add(key)
    const pdsId  = selectedPlan?.key
    const progId = selectedPlan?.program_id
    if (!pdsId) { savingRowsRef.current.delete(key); return }
    try {
      if (isNew(key)) {
        const { data, error } = await supabase
          .from('fin_budget_lines')
          .insert({
            plano_id: pdsId, app_id: b.app_id, program_id: progId,
            category: b.category, capex: b.capex, currency: b.currency,
            values: b.values, note: b.note, source_ref: b.source_ref,
            sort_order: b.sort_order,
          })
          .select()
          .single()
        if (error) throw error
        if (!data) throw new Error('Sem resposta do servidor')
        const realId = (data as FinBudgetLine).id
        setDraft(d => ({
          ...d,
          budget: d.budget.map(line => line.id === key ? { ...line, id: realId } : line),
        }))
        setRowSaved(prev => new Set([...prev, realId]))
        setTimeout(() => setRowSaved(prev => { const n = new Set(prev); n.delete(realId); return n }), 500)
      } else {
        const { error } = await supabase
          .from('fin_budget_lines')
          .upsert({
            id: key, plano_id: pdsId, app_id: b.app_id, program_id: progId,
            category: b.category, capex: b.capex, currency: b.currency,
            values: b.values, note: b.note, source_ref: b.source_ref, sort_order: b.sort_order,
          }, { onConflict: 'id' })
        if (error) throw error
        setRowSaved(prev => new Set([...prev, key]))
        setTimeout(() => setRowSaved(prev => { const n = new Set(prev); n.delete(key); return n }), 500)
      }
    } catch (e) {
      setErrToast(e instanceof Error ? e.message : 'Erro ao guardar rubrica')
      setTimeout(() => setErrToast(null), 3000)
    } finally {
      savingRowsRef.current.delete(key)
    }
  }, [selectedPlan])

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
        {errToast && <span className="gf-save-err">{errToast}</span>}
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
            <KpiCard label="Orçamento Total"  value={fmtEur(kpis.budgetTotal,  defaultSymbol)} color="navy" />
            <KpiCard label="Adjudicado"        value={fmtEur(kpis.adjudicado,  defaultSymbol)} color="blue" />
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
              onSaveLine={saveBudgetLine}
              savedRows={rowSaved}
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
              currencies={currencies}
            />
          )}
          {tab === 'facturas' && (
            <InvoicesTab
              invoices={draft.invoices}
              onNew={openNewInvoice}
              onEdit={openEditInvoice}
              onDelete={deleteInvoice}
              onDuplicate={duplicateInvoice}
              contracts={draft.contracts}
              currencies={currencies}
            />
          )}
        </>
      )}

      <Modal
        isOpen={!!contractPanel}
        onClose={() => setContractPanel(null)}
        title={contractPanel?.id ? 'Editar Contrato' : 'Novo Contrato'}
        width={500}
        footer={
          <>
            {contractPanel?.id && (
              <button className="gf-btn gf-btn-danger" onClick={() => { deleteContract(contractPanel.id!); setContractPanel(null) }}
                style={{ marginRight: 'auto' }}>
                Eliminar
              </button>
            )}
            <button className="gf-btn" onClick={() => setContractPanel(null)}>Cancelar</button>
            <button className="gf-btn gf-btn-save" onClick={confirmContract}>Guardar</button>
            {panelErr && <span className="gf-panel-err">{panelErr}</span>}
          </>
        }
      >
        {contractPanel && (
          <ContractModalBody
            form={contractPanel}
            setForm={setContractPanel}
            currencies={currencies}
            categories={categories}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!invoiceModal}
        onClose={() => setInvoiceModal(null)}
        title={invoiceModal?.id ? 'Editar Factura' : 'Nova Factura'}
        width={500}
        footer={
          <>
            {invoiceModal?.id && (
              <button className="gf-btn gf-btn-danger" onClick={deleteInvoiceFromModal}
                style={{ marginRight: 'auto' }}>
                Eliminar
              </button>
            )}
            <button className="gf-btn" onClick={() => setInvoiceModal(null)}>Cancelar</button>
            <button className="gf-btn gf-btn-save" onClick={confirmInvoice}>Guardar</button>
            {invModalErr && <span className="gf-panel-err">{invModalErr}</span>}
          </>
        }
      >
        {invoiceModal && (
          <InvoiceModalBody
            form={invoiceModal}
            setForm={setInvoiceModal}
            contracts={draft.contracts}
            currencies={currencies}
            supplierFilter={invModalSupplierFilter}
            setSupplierFilter={setInvModalSupplierFilter}
          />
        )}
      </Modal>
    </div>
  )
}
