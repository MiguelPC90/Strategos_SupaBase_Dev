import './BudgetPage.css'
import { useState, useMemo, useEffect, useCallback, Fragment } from 'react'
import { ChevronRight, ChevronDown, ChevronLeft } from 'lucide-react'
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
import { useToast } from '../../context/ToastContext'
import type { FinBudgetLine, InvoiceStatus } from '../../types/index'
import RubricaModal,  { type RubricaForm }  from '../../components/Modals/RubricaModal'
import ContratoModal, { type ContractForm } from '../../components/Modals/ContratoModal'
import FacturaModal,  { type InvoiceForm }  from '../../components/Modals/FacturaModal'

// ── Helpers ─────────────────────────────────────────────────────────
interface CurrencyOption { code: string; symbol: string }

const CURRENCY_FALLBACK: CurrencyOption[] = [
  { code: 'EUR', symbol: '€' }, { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' }, { code: 'CHF', symbol: 'CHF' },
  { code: 'AOA', symbol: 'Kz' }, { code: 'MZN', symbol: 'MT' },
]

const INV_STATUSES = ['Prevista', 'Recebida', 'Aprovada', 'Paga', 'Rejeitada']
const TODAY = new Date().toISOString().slice(0, 10)

let _seq = 0
function newAppId(): string { return 'bp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + (++_seq) }

function toEur(amount: number, rate: number | null): number { return amount * (rate ?? 1) }

const REAL_STATUSES      = ['Recebida', 'Aprovada', 'Paga']
const COMMITTED_STATUSES = ['Prevista', 'Recebida', 'Aprovada', 'Paga']

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

interface CategoryOption { id: string; name: string; is_capex: boolean }

interface TreeNode {
  id: string
  level: 'program' | 'eixo' | 'plano' | 'rubrica'
  designation: string
  tipo: string
  yearTotals: Record<string, number>
  total: number
  children: TreeNode[]
}

// ── TreeRow — recursive table rows ───────────────────────────────────
interface TreeRowProps {
  node: TreeNode
  depth: number
  budgetYears: string[]
  defaultSymbol: string
  expandedKeys: Set<string>
  toggleExpand: (id: string) => void
}

function TreeRow({ node, depth, budgetYears, defaultSymbol, expandedKeys, toggleExpand }: TreeRowProps) {
  const isExpanded = expandedKeys.has(node.id)
  const hasChildren = node.children.length > 0
  const isLeaf = node.level === 'rubrica'
  const desigPadding = 8 + depth * 16

  return (
    <Fragment>
      <tr
        className={depth === 0 ? 'bp-agg-row' : 'bp-sub-row'}
        style={
          depth === 0 && !hasChildren ? { cursor: 'default' } :
          depth > 0 && hasChildren ? { cursor: 'pointer' } :
          undefined
        }
        onClick={hasChildren ? () => toggleExpand(node.id) : undefined}
      >
        <td>
          {hasChildren && (
            <button
              className="gf-icon-btn"
              onClick={e => { e.stopPropagation(); toggleExpand(node.id) }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </td>
        <td
          className="bp-desig-cell"
          title={node.designation}
          style={{
            paddingLeft: desigPadding,
            fontWeight: depth === 0 ? 600 : undefined,
            color: isLeaf ? 'var(--text2)' : undefined,
            fontSize: isLeaf ? 12 : undefined,
          }}
        >
          {node.designation}
        </td>
        <td className="gf-td-c">
          {isLeaf && node.tipo !== '—' ? (
            <span style={{
              display: 'inline-block', padding: '2px 8px', borderRadius: 999,
              fontSize: 11, fontWeight: 500,
              background: node.tipo === 'CAPEX' ? '#EBF0FA' : '#FDF3E7',
              color: node.tipo === 'CAPEX' ? 'var(--blue)' : 'var(--amber)',
            }}>
              {node.tipo}
            </span>
          ) : (
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
          )}
        </td>
        {budgetYears.map(y => (
          <td key={y} className="gf-td-r"
            style={isLeaf ? { color: 'var(--text2)', fontSize: 12 } : undefined}>
            {fmtEur(node.yearTotals[y] ?? 0, defaultSymbol)}
          </td>
        ))}
        <td
          className={isLeaf ? 'gf-td-r' : 'gf-td-total'}
          style={isLeaf ? { color: 'var(--text2)', fontSize: 12, fontWeight: 600 } : undefined}
        >
          {fmtEur(node.total, defaultSymbol)}
        </td>
      </tr>
      {isExpanded && node.children.map(child => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          budgetYears={budgetYears}
          defaultSymbol={defaultSymbol}
          expandedKeys={expandedKeys}
          toggleExpand={toggleExpand}
        />
      ))}
    </Fragment>
  )
}

// ── Component ────────────────────────────────────────────────────────
export default function BudgetPage() {
  const { showToast } = useToast()
  const { filters }  = useFilters()
  const programs     = useAccessiblePrograms('gestao-financeira')
  const programId    = filters.programIds[0]
  const n1Name       = filters.n1Values[0]   ?? null
  const n2Name       = filters.n2Values[0]   ?? null

  const { planos, loading: planosLoading } = usePlanos(programId)
  const { budgetLines, contracts: allContracts, invoices: allInvoices, loading: finLoading, refetch } = useFinancials(programId)

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

  // Categories + management years — per program
  const [categories,      setCategories]      = useState<CategoryOption[]>([])
  const [managementYears, setManagementYears] = useState<string[]>([])

  useEffect(() => {
    if (!programId) { setCategories([]); setManagementYears([]); return }
    let cancelled = false
    Promise.all([
      supabase.from('cost_category_programs')
        .select('category_id')
        .eq('program_id', programId)
        .then(async ({ data: links }) => {
          if (!links || links.length === 0) return []
          const ids = (links as { category_id: string }[]).map(l => l.category_id)
          const { data: cats } = await supabase
            .from('cost_categories').select('id, name, is_capex').in('id', ids).order('name')
          return (cats ?? []).map((c: { id: string; name: string; is_capex: boolean }) => c)
        }),
      supabase.from('management_years')
        .select('year').eq('program_id', programId).order('year')
        .then(({ data }) => (data ?? []).map((y: { year: number }) => String(y.year))),
    ]).then(([cats, years]) => {
      if (cancelled) return
      setCategories(cats)
      setManagementYears(years)
    })
    return () => { cancelled = true }
  }, [programId])

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

  // ── Plano selector options (for create modals) ────────────────────
  const planoOptions = useMemo(
    () => scopedPlanos.map(p => ({ value: p.id, label: p.name })),
    [scopedPlanos])
  const defaultPlanoId = scopedPlanos.length === 1 ? scopedPlanos[0].id : undefined

  // ── Mode B state ─────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState<BpTab>('budget')
  const [expandedKeys,    setExpandedKeys]    = useState<Set<string>>(new Set())
  const [invStatusFilter, setInvStatusFilter] = useState('Todos')
  const [invPageSize,     setInvPageSize]     = useState(25)
  const [invPage,         setInvPage]         = useState(0)

  useEffect(() => { setInvPage(0) }, [invStatusFilter, invPageSize, scopedInvoices.length])

  const toggleExpand = (id: string) => setExpandedKeys(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  // ── Budget years ─────────────────────────────────────────────────
  const budgetYears = useMemo(() => {
    const ks = new Set<string>()
    scopedBudget.forEach(b => Object.keys(b.values).forEach(k => ks.add(k)))
    return Array.from(ks).sort()
  }, [scopedBudget])

  // ── Hierarchical budget tree ──────────────────────────────────────
  const budgetTree = useMemo((): TreeNode[] => {
    const linesByPlano = new Map<string, FinBudgetLine[]>()
    scopedBudget.forEach(b => {
      const pid = b.plano_id ?? ''
      const arr = linesByPlano.get(pid)
      if (arr) arr.push(b)
      else linesByPlano.set(pid, [b])
    })

    const planoNodeMap = new Map<string, TreeNode>()
    scopedPlanos.forEach(p => {
      const lines = linesByPlano.get(p.id) ?? []
      const rubricaKids: TreeNode[] = lines.map(b => {
        const yt: Record<string, number> = {}
        let tot = 0
        Object.entries(b.values).forEach(([y, v]) => { yt[y] = v; tot += v })
        const capex = b.cost_categories?.is_capex
        return {
          id: `rubrica:${b.id}`, level: 'rubrica',
          designation: b.cost_categories?.name ?? 'Sem categoria',
          tipo: capex == null ? '—' : capex ? 'CAPEX' : 'OPEX',
          yearTotals: yt, total: tot, children: [],
        }
      })
      const yt: Record<string, number> = {}
      let tot = 0
      rubricaKids.forEach(r => {
        Object.entries(r.yearTotals).forEach(([y, v]) => { yt[y] = (yt[y] ?? 0) + v })
        tot += r.total
      })
      planoNodeMap.set(p.id, {
        id: `plano:${p.id}`, level: 'plano',
        designation: p.name, tipo: '—', yearTotals: yt, total: tot, children: rubricaKids,
      })
    })

    if (n1Name) {
      return scopedPlanos.map(p => planoNodeMap.get(p.id)).filter((n): n is TreeNode => n != null)
    }

    const eixoOrder: string[] = []
    const eixoMeta = new Map<string, { progId: string; name: string; kids: TreeNode[] }>()
    scopedPlanos.forEach(p => {
      const ek = `${p.program_id ?? ''}::${p.eixo?.name ?? ''}`
      if (!eixoMeta.has(ek)) {
        eixoOrder.push(ek)
        eixoMeta.set(ek, { progId: p.program_id ?? '', name: p.eixo?.name ?? 'Sem eixo', kids: [] })
      }
      const pNode = planoNodeMap.get(p.id)
      if (pNode) eixoMeta.get(ek)!.kids.push(pNode)
    })

    const progEixoMap = new Map<string, TreeNode[]>()
    eixoOrder.forEach(ek => {
      const meta = eixoMeta.get(ek)!
      const yt: Record<string, number> = {}
      let tot = 0
      meta.kids.forEach(k => {
        Object.entries(k.yearTotals).forEach(([y, v]) => { yt[y] = (yt[y] ?? 0) + v })
        tot += k.total
      })
      const node: TreeNode = {
        id: `eixo:${ek}`, level: 'eixo',
        designation: meta.name, tipo: '—', yearTotals: yt, total: tot, children: meta.kids,
      }
      const arr = progEixoMap.get(meta.progId)
      if (arr) arr.push(node)
      else progEixoMap.set(meta.progId, [node])
    })

    if (programId) return progEixoMap.get(programId) ?? []

    return programs.map(prog => {
      const kids = progEixoMap.get(prog.id) ?? []
      const yt: Record<string, number> = {}
      let tot = 0
      kids.forEach(k => {
        Object.entries(k.yearTotals).forEach(([y, v]) => { yt[y] = (yt[y] ?? 0) + v })
        tot += k.total
      })
      return {
        id: `program:${prog.id}`, level: 'program',
        designation: prog.name, tipo: '—', yearTotals: yt, total: tot, children: kids,
      }
    })
  }, [scopedBudget, scopedPlanos, programs, programId, n1Name])

  // ── Footer totals ─────────────────────────────────────────────────
  const grandBudgetTotal = useMemo(() => scopedBudget.reduce((s, b) => s + lineTotal(b), 0), [scopedBudget])
  const yearGrandTotals  = useMemo(() => {
    const t: Record<string, number> = {}
    scopedBudget.forEach(b => Object.entries(b.values).forEach(([y, v]) => { t[y] = (t[y] ?? 0) + v }))
    return t
  }, [scopedBudget])

  // ── Plano name map (contracts + invoices tabs) ────────────────────
  const planoNameMap = useMemo(() => new Map(scopedPlanos.map(p => [p.id, p.name])), [scopedPlanos])

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

  // ── Modal: Rubrica ────────────────────────────────────────────────
  const BLANK_RUBRICA: RubricaForm = { category_id: null, currency: defaultCurrency, values: {}, note: '' }
  const [rubricaOpen, setRubricaOpen] = useState(false)
  const [rubricaForm, setRubricaForm] = useState<RubricaForm>(BLANK_RUBRICA)
  const [rubricaErr,  setRubricaErr]  = useState<string | null>(null)

  const openRubrica = () => {
    const baseValues: Record<string, number> = Object.fromEntries(managementYears.map(y => [y, 0]))
    setRubricaForm({ category_id: null, currency: defaultCurrency, values: baseValues, note: '' })
    setRubricaErr(null)
    setRubricaOpen(true)
  }

  const confirmRubrica = useCallback(async (planoId: string, form: RubricaForm) => {
    if (!programId) { setRubricaErr('Programa não seleccionado.'); return }
    if (!form.category_id) { setRubricaErr('Categoria obrigatória.'); return }
    const plano = scopedPlanos.find(p => p.id === planoId)
    if (!plano) { setRubricaErr('Plano inválido.'); return }
    try {
      const { error } = await supabase.from('fin_budget_lines').insert({
        plano_id: planoId, program_id: programId, app_id: newAppId(),
        category_id: form.category_id, currency: form.currency,
        values: form.values, note: form.note || null, source_ref: null, sort_order: 0,
      })
      if (error) throw error
      showToast(`Criado em ${plano.name}`, 'success')
      setRubricaOpen(false)
      setRubricaErr(null)
      refetch()
    } catch (e) {
      setRubricaErr(e instanceof Error ? e.message : 'Erro ao guardar.')
    }
  }, [programId, scopedPlanos, showToast, refetch])

  // ── Modal: Contrato ───────────────────────────────────────────────
  const BLANK_CONTRACT: ContractForm = {
    id: null, supplier: '', category: '', total_amount: '',
    currency: defaultCurrency, exchange_rate_ref: '', award_date: '', end_date: '', description: '',
  }
  const [contratoOpen, setContratoOpen] = useState(false)
  const [contratoForm, setContratoForm] = useState<ContractForm>(BLANK_CONTRACT)
  const [contratoErr,  setContratoErr]  = useState<string | null>(null)

  const openContrato = () => {
    setContratoForm({ ...BLANK_CONTRACT, currency: defaultCurrency })
    setContratoErr(null)
    setContratoOpen(true)
  }

  const confirmContrato = useCallback(async (planoId?: string) => {
    if (!planoId || !programId) { setContratoErr('Plano e programa obrigatórios.'); return }
    if (!contratoForm.supplier.trim()) { setContratoErr('Fornecedor obrigatório.'); return }
    const totalAmt = parseFloat(contratoForm.total_amount)
    if (isNaN(totalAmt) || totalAmt < 0) { setContratoErr('Valor inválido.'); return }
    const plano  = scopedPlanos.find(p => p.id === planoId)
    const exRate = contratoForm.exchange_rate_ref !== '' ? parseFloat(contratoForm.exchange_rate_ref) : null
    try {
      const { error } = await supabase.from('fin_contracts').insert({
        plano_id: planoId, program_id: programId, app_id: newAppId(),
        supplier: contratoForm.supplier.trim(), category: contratoForm.category,
        total_amount: totalAmt, currency: contratoForm.currency,
        exchange_rate_ref: exRate,
        award_date: contratoForm.award_date || null,
        end_date: contratoForm.end_date || null,
        description: contratoForm.description || null,
        sort_order: 0,
      })
      if (error) throw error
      showToast(`Criado em ${plano?.name ?? planoId}`, 'success')
      setContratoOpen(false)
      setContratoErr(null)
      refetch()
    } catch (e) {
      setContratoErr(e instanceof Error ? e.message : 'Erro ao guardar.')
    }
  }, [contratoForm, programId, scopedPlanos, showToast, refetch])

  // ── Modal: Factura ────────────────────────────────────────────────
  const BLANK_INVOICE: InvoiceForm = {
    id: null, ref: '', supplier: '', app_contract_id: '', doc_type: 'Factura',
    amount: '', currency: defaultCurrency, exchange_rate: '',
    issue_date: '', due_date: '', payment_date: '', status: 'Prevista',
  }
  const [facturaOpen,           setFacturaOpen]           = useState(false)
  const [facturaForm,           setFacturaForm]           = useState<InvoiceForm>(BLANK_INVOICE)
  const [facturaErr,            setFacturaErr]            = useState<string | null>(null)
  const [facturaSupplierFilter, setFacturaSupplierFilter] = useState('')

  const openFactura = () => {
    setFacturaForm({ ...BLANK_INVOICE, currency: defaultCurrency })
    setFacturaErr(null)
    setFacturaSupplierFilter('')
    setFacturaOpen(true)
  }

  const confirmFactura = useCallback(async (planoId?: string) => {
    if (!planoId || !programId) { setFacturaErr('Plano e programa obrigatórios.'); return }
    const amount = parseFloat(facturaForm.amount)
    if (isNaN(amount) || amount < 0) { setFacturaErr('Montante inválido.'); return }
    const plano  = scopedPlanos.find(p => p.id === planoId)
    const exRate = facturaForm.exchange_rate !== '' ? parseFloat(facturaForm.exchange_rate) : null
    const ctrId  = scopedContracts.find(c => c.app_id === facturaForm.app_contract_id)?.id ?? null
    try {
      const { error } = await supabase.from('fin_invoices').insert({
        plano_id: planoId, program_id: programId, app_id: newAppId(),
        app_contract_id: facturaForm.app_contract_id,
        contract_id: ctrId, ref: facturaForm.ref,
        supplier: facturaForm.supplier, doc_type: facturaForm.doc_type,
        amount, currency: facturaForm.currency, exchange_rate: exRate,
        issue_date: facturaForm.issue_date || null,
        due_date: facturaForm.due_date || null,
        payment_date: facturaForm.payment_date || null,
        status: facturaForm.status as InvoiceStatus,
        sort_order: 0,
      })
      if (error) throw error
      showToast(`Criado em ${plano?.name ?? planoId}`, 'success')
      setFacturaOpen(false)
      setFacturaErr(null)
      refetch()
    } catch (e) {
      setFacturaErr(e instanceof Error ? e.message : 'Erro ao guardar.')
    }
  }, [facturaForm, programId, scopedPlanos, scopedContracts, showToast, refetch])

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

  const canCreate = !!programId
  const disabledBtnStyle: React.CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }

  const _bpFactCid      = facturaForm.app_contract_id
  const _bpFactContract = scopedContracts.find(c => c.app_id === _bpFactCid)
  const facturaContractTotal = _bpFactContract
    ? toEur(_bpFactContract.total_amount, _bpFactContract.exchange_rate_ref)
    : undefined
  const facturaContractInvoicedTotal = _bpFactContract
    ? scopedInvoices
        .filter(i =>
          (i.app_contract_id === _bpFactCid || i.contract_id === _bpFactContract.id) &&
          i.id !== facturaForm.id &&
          COMMITTED_STATUSES.includes(i.status)
        )
        .reduce((s, i) => s + toEur(i.amount, i.exchange_rate), 0)
    : undefined

  const TABS: { id: BpTab; label: string }[] = [
    { id: 'budget',    label: 'Orçamento' },
    { id: 'contracts', label: 'Contratos' },
    { id: 'invoices',  label: 'Facturas'  },
  ]

  const bpOrc        = kpis.budgetTotal
  const bpAdj        = kpis.adjudicado
  const bpPctAdj     = bpOrc > 0 ? (bpAdj / bpOrc) * 100 : 0
  const bpPctPago    = bpAdj > 0 ? (kpis.pago / bpAdj) * 100 : 0
  const bpPctEmPag   = bpAdj > 0 ? (kpis.emPagamento / bpAdj) * 100 : 0
  const bpPctPorFac  = bpAdj > 0 ? (Math.max(0, kpis.porFacturar) / bpAdj) * 100 : 0
  const bpDisponivel = bpOrc - bpAdj
  const bpPctDisp    = bpOrc > 0 ? (bpDisponivel / bpOrc) * 100 : 0
  const bpOverBudget = bpDisponivel < 0

  return (
    <div className="bp-page">
      {/* ── KPI row ── */}
      <div className="gf-kpi-row">
        <KpiCard variant="hero" label="Orçamento"         value={fmtEur(bpOrc, defaultSymbol)} color="navy" />
        <KpiCard variant="hero" label="Adjudicado"         value={fmtEur(bpAdj, defaultSymbol)} color="blue"
          subtitle={`${bpPctAdj.toFixed(1)}% do valor orçamentado`} />
        <KpiCard variant="hero" label="Pago"               value={fmtEur(kpis.pago, defaultSymbol)} color="green"
          subtitle={`${bpPctPago.toFixed(1)}% do valor adjudicado`} />
        <KpiCard variant="hero" label="Em Pagamento"       value={fmtEur(kpis.emPagamento, defaultSymbol)} color="amber"
          subtitle={`${bpPctEmPag.toFixed(1)}% do valor adjudicado`} />
        <KpiCard variant="hero" label="Por Facturar"       value={fmtEur(Math.max(0, kpis.porFacturar), defaultSymbol)} color="text"
          subtitle={`${bpPctPorFac.toFixed(1)}% do valor adjudicado`} />
        <KpiCard
          variant="hero"
          label="Orçamento Disponível"
          value={fmtEur(Math.abs(bpDisponivel), defaultSymbol)}
          color={bpOverBudget ? 'red' : 'green'}
          subtitle={bpOverBudget
            ? `${Math.abs(bpPctDisp).toFixed(1)}% acima do orçamento`
            : `${bpPctDisp.toFixed(1)}% do valor orçamentado`}
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
            <button
              className="btn-primary"
              disabled={!canCreate}
              title={canCreate ? undefined : 'Selecciona um programa para criar'}
              style={canCreate ? undefined : disabledBtnStyle}
              onClick={canCreate ? openRubrica : undefined}
            >+ Rubrica</button>
          </div>
          {budgetTree.length === 0 ? (
            <div className="gf-empty" style={{ border: 'none' }}>Sem rubricas orçamentais.</div>
          ) : (
            <table className="gf-budget-table tbl-default" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr>
                  <th className="t-label" style={{ width: 28 }} />
                  <th className="t-label">Designação</th>
                  <th className="gf-th-c t-label" style={{ width: 80 }}>Tipo</th>
                  {budgetYears.map(y => (
                    <th key={y} className="gf-th-r t-label" style={{ width: 130 }}>{y}</th>
                  ))}
                  <th className="gf-th-r t-label" style={{ width: 150 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {budgetTree.map(node => (
                  <TreeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    budgetYears={budgetYears}
                    defaultSymbol={defaultSymbol}
                    expandedKeys={expandedKeys}
                    toggleExpand={toggleExpand}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="gf-total-row">
                  <td />
                  <td colSpan={2}>Total orçamentado</td>
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
            <button
              className="btn-primary"
              disabled={!canCreate}
              title={canCreate ? undefined : 'Selecciona um programa para criar'}
              style={canCreate ? undefined : disabledBtnStyle}
              onClick={canCreate ? openContrato : undefined}
            >+ Novo Contrato</button>
          </div>
          {sortedContracts.length === 0 ? (
            <div className="gf-empty">Sem contratos.</div>
          ) : (
            sortedContracts.map(c => {
              const sym          = currencies.find(cur => cur.code === c.currency)?.symbol ?? defaultSymbol
              const contractInvs = scopedInvoices.filter(i => i.app_contract_id === c.app_id || i.contract_id === c.id)
              const invoicedEur  = contractInvs
                .filter(i => REAL_STATUSES.includes(i.status))
                .reduce((s, i) => s + toEur(i.amount, i.exchange_rate), 0)
              const committedEur   = contractInvs
                .filter(i => COMMITTED_STATUSES.includes(i.status))
                .reduce((s, i) => s + toEur(i.amount, i.exchange_rate), 0)
              const totalEur       = toEur(c.total_amount, c.exchange_rate_ref)
              const nativeInvoiced = c.exchange_rate_ref ? invoicedEur / c.exchange_rate_ref : invoicedEur
              const pct            = totalEur > 0 ? Math.round((invoicedEur / totalEur) * 100) : 0
              const isOverCommitted = totalEur > 0 && committedEur > totalEur
              const planoName      = planoNameMap.get(c.plano_id ?? '') ?? ''
              return (
                <div key={c.id} className={`gf-contract-card${isOverCommitted ? ' is-overflow' : ''}`}>
                  <div className="gf-contract-header">
                    <div style={{ flex: 1 }}>
                      <div className="gf-contract-title">
                        {c.supplier || '(sem fornecedor)'}
                        {isOverCommitted && <span className="gf-contract-overflow-badge">Excedido</span>}
                      </div>
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
            <button
              className="btn-primary"
              disabled={!canCreate}
              title={canCreate ? undefined : 'Selecciona um programa para criar'}
              style={canCreate ? undefined : disabledBtnStyle}
              onClick={canCreate ? openFactura : undefined}
            >+ Factura</button>
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
              <button className="btn" onClick={() => setInvPage(p => p - 1)} disabled={invPage === 0}>
                <ChevronLeft size={14} strokeWidth={1.5} /> Anterior
              </button>
              <button
                className="btn"
                onClick={() => setInvPage(p => p + 1)}
                disabled={(invPage + 1) * invPageSize >= totalInvoices}
              >Próxima <ChevronRight size={14} strokeWidth={1.5} /></button>
            </div>
          )}
        </div>
      )}

      {/* ── Create modals ── */}
      <RubricaModal
        isOpen={rubricaOpen}
        onClose={() => setRubricaOpen(false)}
        onSave={confirmRubrica}
        form={rubricaForm}
        setForm={setRubricaForm}
        categories={categories}
        currencies={currencies}
        managementYears={managementYears}
        errorMessage={rubricaErr}
        planoOptions={planoOptions}
        defaultPlanoId={defaultPlanoId}
        mode="create"
      />

      <ContratoModal
        isOpen={contratoOpen}
        onClose={() => setContratoOpen(false)}
        onSave={confirmContrato}
        form={contratoForm}
        setForm={setContratoForm}
        categories={categories}
        currencies={currencies}
        errorMessage={contratoErr}
        planoOptions={planoOptions}
        defaultPlanoId={defaultPlanoId}
      />

      <FacturaModal
        isOpen={facturaOpen}
        onClose={() => setFacturaOpen(false)}
        onSave={confirmFactura}
        form={facturaForm}
        setForm={setFacturaForm}
        contracts={scopedContracts}
        currencies={currencies}
        supplierFilter={facturaSupplierFilter}
        setSupplierFilter={setFacturaSupplierFilter}
        errorMessage={facturaErr}
        planoOptions={planoOptions}
        defaultPlanoId={defaultPlanoId}
        contractTotal={facturaContractTotal}
        contractInvoicedTotal={facturaContractInvoicedTotal}
      />
    </div>
  )
}
