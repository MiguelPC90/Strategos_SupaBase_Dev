import './ExecucaoFinanceira.css'
import { useState, useMemo, useEffect, type ReactNode } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import Spinner from '../../components/Spinner/Spinner'
import EmptyState from '../../components/EmptyState/EmptyState'
import MultiSelect from '../../components/MultiSelect/MultiSelect'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LabelList, LineChart, Line,
} from 'recharts'
import Card from '../../components/Card/Card'
import { invoiceAlert } from '../../lib/invoiceHelpers'
import { useFinancials } from '../../hooks/useFinancials'
import { useAppConfig } from '../../hooks/useAppConfig'
import type { FinBudgetLine } from '../../types/index'
import { usePlanos } from '../../hooks/usePlanos'
import { useAccessiblePrograms } from '../../hooks/useAccessiblePrograms'
import { usePermissions } from '../../hooks/usePermissions'
import { useFilters } from '../../context/FilterContext'
import { supabase } from '../../lib/supabase'
import { colors, chartDefaults } from '../../lib/tokens'

// ── Helpers ────────────────────────────────────────────────────
function sumByYears(values: Record<string, number>, years: string[]): number {
  if (years.length === 0) return Object.values(values).reduce((s, v) => s + v, 0)
  return Object.entries(values)
    .filter(([k]) => years.some(y => k === y || k.startsWith(y + '-')))
    .reduce((s, [, v]) => s + v, 0)
}

function fmtEur(val: number, sym = '€'): string {
  return val.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ' + sym
}

function fmtPct(val: number): string {
  return val.toFixed(1) + '%'
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${m.padStart(2, '0')}/${y.slice(2)}`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// Resolve category name: joined cost_categories first, then legacy TEXT fallback
function bCatName(b: FinBudgetLine): string {
  return b.cost_categories?.name ?? b.category ?? ''
}
// Resolve CAPEX flag: joined cost_categories first, then legacy boolean fallback
function bIsCapex(b: FinBudgetLine): boolean {
  return b.cost_categories?.is_capex ?? b.capex ?? false
}

function compactNumber(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return (v / 1e3).toFixed(0) + 'k'
  return v.toFixed(0)
}

const ChartEmpty = () => (
  <p className="ef-chart-empty">Sem dados para os filtros seleccionados.</p>
)

function ProgressCell({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const color = clamped >= 100 ? 'var(--green)' : 'var(--blue)'
  return (
    <div className="ef-progress-cell">
      <div className="ef-progress-track">
        <div className="ef-progress-fill" style={{ width: `${clamped}%`, background: color }} />
      </div>
      <span className="ef-progress-label">{fmtPct(pct)}</span>
    </div>
  )
}

// ── Chart sub-components ──────────────────────────────────────

interface PieEntry    { name: string; value: number; fill: string }
interface OverviewBar { label: string; value: number; color: string }
interface MonthStatusBar {
  month: string; Pago: number; Aprovada: number; Recebida: number; Prevista: number
}
interface BurnRatePoint {
  month: string
  orcamento_acum: number
  executado_acum: number
}
interface SupplierBar { name: string; value: number }

function CapexOpexDonut({ data, sym }: { data: PieEntry[]; sym: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <ChartEmpty />
  return (
    <div className="ef-donut-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="value" cx="50%" cy="42%" innerRadius={60} outerRadius={95}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Pie>
          <Tooltip
            formatter={(v) => fmtEur(v as number, sym)}
            contentStyle={{ fontSize: 12, border: '1px solid var(--border2)' }}
          />
          <Legend
            formatter={(name: string) => {
              const d = data.find(e => e.name === name)
              return d
                ? `${name}: ${compactNumber(d.value)} (${(d.value / total * 100).toFixed(1)}%)`
                : name
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="ef-donut-center">
        <span className="ef-donut-center-label">Total</span>
        <span className="ef-donut-center-value">{compactNumber(total)}</span>
      </div>
    </div>
  )
}

function VisaoGeralChart({ data, sym }: { data: OverviewBar[]; sym: string }) {
  if (!data.some(d => d.value !== 0)) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 28, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartDefaults.gridStroke} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v: number) => compactNumber(v)} tick={{ fontSize: 10 }} width={44} />
        <Tooltip
          formatter={(v) => fmtEur(v as number, sym)}
          contentStyle={{ fontSize: 12, border: '1px solid var(--border2)' }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          <LabelList
            dataKey="value"
            position="top"
            formatter={((v: number) => compactNumber(v)) as never}
            style={{ fontSize: 10, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function MonthlyStatusChart({ data, sym }: { data: MonthStatusBar[]; sym: string }) {
  if (data.length === 0) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartDefaults.gridStroke} vertical={false} />
        <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={(v: number) => compactNumber(v)} tick={{ fontSize: 10 }} width={44} />
        <Tooltip
          formatter={(v) => fmtEur(v as number, sym)}
          labelFormatter={((l: string) => fmtMonth(l)) as never}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Pago"     stackId="s" fill={colors.status.done} />
        <Bar dataKey="Aprovada" stackId="s" fill={colors.status.risk} />
        <Bar dataKey="Recebida" stackId="s" fill={colors.brand.ink700} />
        <Bar dataKey="Prevista" stackId="s" fill={colors.brand.ink300} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function BurnRateChart({ data, sym }: { data: BurnRatePoint[]; sym: string }) {
  if (data.length === 0) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartDefaults.gridStroke} vertical={false} />
        <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={(v: number) => compactNumber(v)} tick={{ fontSize: 10 }} width={44} domain={['auto', 'auto']} />
        <Tooltip
          formatter={(v) => fmtEur(v as number, sym)}
          labelFormatter={((l: string) => fmtMonth(l)) as never}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" />
        <Line type="monotone" dataKey="orcamento_acum" name="Orçamento acumulado" stroke={colors.brand.ink700} strokeWidth={2} connectNulls dot={{ r: 3 }} />
        <Line type="monotone" dataKey="executado_acum" name="Executado acumulado" stroke={colors.brand.ember} strokeWidth={2} connectNulls dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function TopFornecedoresChart({ data, sym }: { data: SupplierBar[]; sym: string }) {
  if (data.length === 0) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 56, left: 0, bottom: 4 }}>
        <XAxis type="number" tickFormatter={(v: number) => compactNumber(v)} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v) => fmtEur(v as number, sym)}
          contentStyle={{ fontSize: 12, border: '1px solid var(--border2)' }}
        />
        <Bar dataKey="value" fill={colors.brand.ink700} radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey="value"
            position="right"
            formatter={((v: number) => compactNumber(v)) as never}
            style={{ fontSize: 10 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Contract estado ────────────────────────────────────────────
function contractEstado(pct: number): { label: string; variant: 'grey' | 'blue' | 'green' } {
  if (pct <= 0)   return { label: 'Não iniciado', variant: 'grey' }
  if (pct >= 100) return { label: 'Concluído',    variant: 'green' }
  return                  { label: 'Em curso',     variant: 'blue' }
}

// ── Main page ──────────────────────────────────────────────────
type TipoFilter = 'todos' | 'capex' | 'opex'

export default function ExecucaoFinanceira() {
  const { filters }  = useFilters()
  const programs = useAccessiblePrograms()

  const programId = filters.programIds[0] ?? programs[0]?.id

  const [selectedYears,       setSelectedYears]       = useState<string[]>([])
  const [tipoFilter,          setTipoFilter]          = useState<TipoFilter>('todos')
  const [currSymbol,          setCurrSymbol]          = useState('€')
  const [mgmtYears,           setMgmtYears]           = useState<string[]>([])
  const [invoiceAlertFilter,  setInvoiceAlertFilter]  = useState<'overdue' | 'due_soon' | null>(null)
  const [detailTab,           setDetailTab]           = useState<'rubricas' | 'contratos'>('rubricas')
  const [sortBy,              setSortBy]              = useState('supplier')
  const [sortDir,             setSortDir]             = useState<'asc' | 'desc'>('asc')

  // Reset year selection when program changes
  useEffect(() => {
    setSelectedYears([])
  }, [programId])

  // Fetch default currency symbol
  useEffect(() => {
    supabase.from('currencies').select('symbol').eq('is_default', true).limit(1)
      .then(({ data }) => { if (data?.[0]?.symbol) setCurrSymbol(data[0].symbol) })
  }, [])

  const { config, getNumber } = useAppConfig()
  const alertThresholds = useMemo(() => ({
    overdue:  getNumber('invoice_alert_overdue', 100),
    due_soon: getNumber('invoice_alert_due_soon', 85),
  }), [config])

  // Fetch management years for the selected program
  useEffect(() => {
    if (!programId) { setMgmtYears([]); return }
    let cancelled = false
    supabase
      .from('management_years')
      .select('year')
      .eq('program_id', programId)
      .order('year')
      .then(({ data }) => {
        if (cancelled) return
        setMgmtYears(data?.map(r => String(r.year)) ?? [])
      })
    return () => { cancelled = true }
  }, [programId])

  const { budgetLines, contracts, invoices, loading } = useFinancials(programId)
  const { planos }                                    = usePlanos(programId)
  const { hasAccess }                                 = usePermissions()

  const accessiblePlanIds = useMemo(
    () => new Set(planos.filter(p => hasAccess('exec-financeira', p.program_id ?? undefined, p.id)).map(p => p.id)),
    [planos, hasAccess],
  )
  const visiblePlanos = useMemo(
    () => planos.filter(p => accessiblePlanIds.has(p.id)),
    [planos, accessiblePlanIds],
  )

  // ── Breadcrumb + owner/sponsor plano scope ───────────────────
  const breadcrumbPlanoId = useMemo(() => {
    const n2Name = filters.n2Values[0] ?? null
    if (!n2Name) return null
    return visiblePlanos.find(p => p.name === n2Name)?.id ?? null
  }, [filters.n2Values, visiblePlanos])

  const ownerPlanoIds = useMemo(() => {
    if (filters.owners.length === 0) return null
    return new Set(
      visiblePlanos.filter(p =>
        p.owner_person_ids.some(id => filters.owners.includes(id))
      ).map(p => p.id)
    )
  }, [filters.owners, visiblePlanos])

  const sponsorPlanoIds = useMemo(() => {
    if (filters.sponsors.length === 0) return null
    return new Set(
      visiblePlanos.filter(p =>
        p.sponsor_person_ids.some(id => filters.sponsors.includes(id))
      ).map(p => p.id)
    )
  }, [filters.sponsors, visiblePlanos])

  // ── Accessible base data (plan-level permission filter) ─────
  const accessibleBudgetLines = useMemo(
    () => budgetLines.filter(l => !l.plano_id || accessiblePlanIds.has(l.plano_id)),
    [budgetLines, accessiblePlanIds],
  )
  const accessibleContracts = useMemo(
    () => contracts.filter(c => !c.plano_id || accessiblePlanIds.has(c.plano_id)),
    [contracts, accessiblePlanIds],
  )
  const accessibleInvoices = useMemo(
    () => invoices.filter(i => !i.plano_id || accessiblePlanIds.has(i.plano_id)),
    [invoices, accessiblePlanIds],
  )

  // ── Year options (management_years, fallback to budget line keys) ─
  const yearOptions = useMemo(() => {
    if (mgmtYears.length > 0) return mgmtYears
    const years = new Set<string>()
    for (const l of accessibleBudgetLines) {
      for (const key of Object.keys(l.values)) years.add(key.split('-')[0])
    }
    return [...years].sort()
  }, [mgmtYears, budgetLines])

  // ── Step 1: plano/owner/sponsor-filtered data ─────────────────
  const planLines = useMemo(() => {
    return accessibleBudgetLines.filter(l =>
      (!breadcrumbPlanoId || l.plano_id === breadcrumbPlanoId) &&
      (!ownerPlanoIds     || (l.plano_id !== null && ownerPlanoIds.has(l.plano_id))) &&
      (!sponsorPlanoIds   || (l.plano_id !== null && sponsorPlanoIds.has(l.plano_id)))
    )
  }, [accessibleBudgetLines, breadcrumbPlanoId, ownerPlanoIds, sponsorPlanoIds])
  const planCtrs = useMemo(() => {
    return accessibleContracts.filter(c =>
      (!breadcrumbPlanoId || c.plano_id === breadcrumbPlanoId) &&
      (!ownerPlanoIds     || (c.plano_id !== null && ownerPlanoIds.has(c.plano_id))) &&
      (!sponsorPlanoIds   || (c.plano_id !== null && sponsorPlanoIds.has(c.plano_id)))
    )
  }, [accessibleContracts, breadcrumbPlanoId, ownerPlanoIds, sponsorPlanoIds])
  const planInvs = useMemo(() => {
    return accessibleInvoices.filter(i =>
      (!breadcrumbPlanoId || i.plano_id === breadcrumbPlanoId) &&
      (!ownerPlanoIds     || (i.plano_id !== null && ownerPlanoIds.has(i.plano_id))) &&
      (!sponsorPlanoIds   || (i.plano_id !== null && sponsorPlanoIds.has(i.plano_id)))
    )
  }, [accessibleInvoices, breadcrumbPlanoId, ownerPlanoIds, sponsorPlanoIds])

  // Category → isCapex map (based on all plano lines, ignoring tipo chip)
  const catCapexMap = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const l of planLines) {
      const name = bCatName(l)
      if (!m.has(name)) m.set(name, bIsCapex(l))
    }
    return m
  }, [planLines])

  // ── Step 2: CAPEX/OPEX filter ────────────────────────────────
  const lines = useMemo(() => {
    if (tipoFilter === 'todos') return planLines
    return planLines.filter(l => tipoFilter === 'capex' ? bIsCapex(l) : !bIsCapex(l))
  }, [planLines, tipoFilter])

  const ctrs = useMemo(() => {
    if (tipoFilter === 'todos') return planCtrs
    const catSet = new Set(lines.map(l => bCatName(l)))
    return planCtrs.filter(c => catSet.has(c.category))
  }, [planCtrs, lines, tipoFilter])

  const invs = useMemo(() => {
    if (tipoFilter === 'todos') return planInvs
    const ctrIds = new Set(ctrs.map(c => c.id))
    return planInvs.filter(i => !i.contract_id || ctrIds.has(i.contract_id))
  }, [planInvs, ctrs, tipoFilter])

  // ── KPIs ─────────────────────────────────────────────────────
  const kpiOrc = useMemo(
    () => lines.reduce((s, l) => s + sumByYears(l.values, selectedYears), 0),
    [lines, selectedYears]
  )
  const kpiAdj     = useMemo(() => ctrs.reduce((s, c) => s + c.total_amount, 0), [ctrs])
  const kpiFact    = useMemo(
    () => invs
      .filter(i => i.status === 'Recebida' || i.status === 'Aprovada' || i.status === 'Paga')
      .reduce((s, i) => s + i.amount, 0),
    [invs]
  )
  const kpiPago    = useMemo(() => invs.filter(i => i.status === 'Paga').reduce((s, i) => s + i.amount, 0), [invs])
  const kpiPorFact = kpiAdj - kpiFact
  const kpiDisp    = kpiOrc - kpiAdj
  const fmt        = (v: number) => fmtEur(v, currSymbol)

  // ── Alert counts ──────────────────────────────────────────────
  const { overdueCount, dueSoonCount } = useMemo(() => {
    let overdueCount = 0, dueSoonCount = 0
    for (const inv of invs) {
      const a = invoiceAlert(inv, alertThresholds)
      if (a === 'overdue')  overdueCount++
      if (a === 'due_soon') dueSoonCount++
    }
    return { overdueCount, dueSoonCount }
  }, [invs, alertThresholds])

  // ── Chart data ────────────────────────────────────────────────
  const visaoGeralData = useMemo<OverviewBar[]>(() => [
    { label: 'Orçamento',    value: kpiOrc,  color: colors.brand.ink700 },
    { label: 'Comprometido', value: kpiAdj,  color: colors.brand.ember },
    { label: 'Facturado',    value: kpiFact, color: colors.status.risk },
    { label: 'Disponível',   value: kpiDisp, color: colors.brand.moss },
  ], [kpiOrc, kpiAdj, kpiFact, kpiDisp])

  const pieData = useMemo<PieEntry[]>(() => [
    { name: 'CAPEX', value: lines.filter(l =>  bIsCapex(l)).reduce((s, l) => s + sumByYears(l.values, selectedYears), 0), fill: colors.brand.ink700 },
    { name: 'OPEX',  value: lines.filter(l => !bIsCapex(l)).reduce((s, l) => s + sumByYears(l.values, selectedYears), 0), fill: colors.brand.ember },
  ], [lines, selectedYears])

  const monthlyStatusData = useMemo<MonthStatusBar[]>(() => {
    const yearInvs = selectedYears.length > 0
      ? invs.filter(i => selectedYears.some(y => (i.issue_date ?? i.due_date ?? '').startsWith(y)))
      : invs

    // Determine month range
    const curYear = new Date().getFullYear()
    let startYM = `${curYear}-01`
    let endYM   = `${curYear}-12`
    if (selectedYears.length > 0) {
      const yrs = [...selectedYears].sort()
      startYM = `${yrs[0]}-01`
      endYM   = `${yrs[yrs.length - 1]}-12`
    } else {
      const dates = yearInvs
        .map(i => i.issue_date ?? i.due_date)
        .filter((d): d is string => !!d)
        .map(d => d.substring(0, 7))
        .sort()
      if (dates.length > 0) { startYM = dates[0]; endYM = dates[dates.length - 1] }
    }

    // Build all months in range initialised to zero
    const map = new Map<string, MonthStatusBar>()
    let [sy, sm] = startYM.split('-').map(Number)
    const [ey, em] = endYM.split('-').map(Number)
    while (sy < ey || (sy === ey && sm <= em)) {
      const key = `${sy}-${String(sm).padStart(2, '0')}`
      map.set(key, { month: key, Pago: 0, Aprovada: 0, Recebida: 0, Prevista: 0 })
      if (++sm > 12) { sm = 1; sy++ }
    }
    for (const inv of yearInvs) {
      const ds = inv.issue_date ?? inv.due_date
      if (!ds || inv.status === 'Rejeitada') continue
      const key = ds.substring(0, 7)
      const row = map.get(key)
      if (!row) continue
      if      (inv.status === 'Paga')     row.Pago     += inv.amount
      else if (inv.status === 'Aprovada') row.Aprovada += inv.amount
      else if (inv.status === 'Recebida') row.Recebida += inv.amount
      else                                row.Prevista += inv.amount
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month))
  }, [invs, selectedYears])

  const burnRateData = useMemo<BurnRatePoint[]>(() => {
    if (monthlyStatusData.length === 0) return []
    const yearsInView = selectedYears.length > 0 ? selectedYears : yearOptions

    // Distribute each year's budget evenly across 12 months
    const monthlyBudget = new Map<string, number>()
    for (const line of lines) {
      for (const year of yearsInView) {
        const perMonth = sumByYears(line.values, [year]) / 12
        for (let m = 1; m <= 12; m++) {
          const key = `${year}-${String(m).padStart(2, '0')}`
          monthlyBudget.set(key, (monthlyBudget.get(key) ?? 0) + perMonth)
        }
      }
    }
    // Monthly executed (invoiced)
    const monthlyExec = new Map<string, number>()
    for (const inv of invs) {
      if (inv.status !== 'Recebida' && inv.status !== 'Aprovada' && inv.status !== 'Paga') continue
      const ds = inv.issue_date ?? inv.due_date
      if (!ds) continue
      const key = ds.substring(0, 7)
      monthlyExec.set(key, (monthlyExec.get(key) ?? 0) + inv.amount)
    }
    let cumOrc = 0, cumExec = 0
    return monthlyStatusData.map(({ month }) => {
      cumOrc  += monthlyBudget.get(month) ?? 0
      cumExec += monthlyExec.get(month)   ?? 0
      return { month, orcamento_acum: Math.round(cumOrc), executado_acum: Math.round(cumExec) }
    })
  }, [monthlyStatusData, lines, invs, selectedYears, yearOptions])

  const topFornecedoresData = useMemo<SupplierBar[]>(() => {
    const map = new Map<string, number>()
    for (const c of ctrs) map.set(c.supplier, (map.get(c.supplier) ?? 0) + c.total_amount)
    return [...map.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }))
  }, [ctrs])

  // ── Sort helpers ──────────────────────────────────────────────
  function handleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }
  const arrow = (col: string): ReactNode => sortBy === col
    ? (sortDir === 'asc'
        ? <ArrowUp size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} />
        : <ArrowDown size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} />)
    : null

  // ── Category rows ─────────────────────────────────────────────
  const catRows = useMemo(() => {
    const cats = [...new Set(lines.map(l => bCatName(l)))].sort()
    return cats.map(cat => {
      const catLines    = lines.filter(l => bCatName(l) === cat)
      const orc         = catLines.reduce((s, l) => s + sumByYears(l.values, selectedYears), 0)
      const isCapex     = catLines.some(l => bIsCapex(l))
      const catCtrs     = ctrs.filter(c => c.category === cat)
      const adj         = catCtrs.reduce((s, c) => s + c.total_amount, 0)
      const catCtrIds   = new Set(catCtrs.map(c => c.id))
      const catCtrAppIds = new Set(catCtrs.map(c => c.app_id).filter((id): id is string => !!id))
      const catInvs     = invs.filter(i =>
        (i.contract_id && catCtrIds.has(i.contract_id)) ||
        (i.app_contract_id && catCtrAppIds.has(i.app_contract_id))
      )
      const fact        = catInvs
        .filter(i => i.status === 'Recebida' || i.status === 'Aprovada' || i.status === 'Paga')
        .reduce((s, i) => s + i.amount, 0)
      const pago        = catInvs.filter(i => i.status === 'Paga').reduce((s, i) => s + i.amount, 0)
      const pctAdj      = orc > 0 ? adj / orc * 100 : 0
      const pctFact     = adj > 0 ? fact / adj * 100 : 0
      const disp        = orc - adj
      return { cat, isCapex, orc, adj, pctAdj, fact, pago, pctFact, disp }
    })
  }, [lines, ctrs, invs, selectedYears])

  // ── Contract rows ─────────────────────────────────────────────
  const ctrRows = useMemo(() => ctrs.map(c => {
    const cInvs      = invs.filter(i => i.contract_id === c.id || i.app_contract_id === c.app_id)
    const fact       = cInvs
      .filter(i => i.status === 'Recebida' || i.status === 'Aprovada' || i.status === 'Paga')
      .reduce((s, i) => s + i.amount, 0)
    const isCapex    = catCapexMap.get(c.category) ?? false
    const pct        = c.total_amount > 0 ? fact / c.total_amount * 100 : 0
    const hasOverdue = cInvs.some(i => invoiceAlert(i, alertThresholds) === 'overdue')
    const hasDueSoon = cInvs.some(i => invoiceAlert(i, alertThresholds) === 'due_soon')
    return { c, fact, pct, isCapex, hasOverdue, hasDueSoon }
  }), [ctrs, invs, catCapexMap, alertThresholds])

  const sortedCtrRows = useMemo(() => {
    let rows = ctrRows
    if (invoiceAlertFilter === 'overdue')  rows = rows.filter(r => r.hasOverdue)
    if (invoiceAlertFilter === 'due_soon') rows = rows.filter(r => r.hasDueSoon)
    return [...rows].sort((a, b) => {
      let av: string | number = '', bv: string | number = ''
      switch (sortBy) {
        case 'supplier':     av = a.c.supplier;         bv = b.c.supplier;         break
        case 'category':     av = a.c.category;         bv = b.c.category;         break
        case 'currency':     av = a.c.currency;         bv = b.c.currency;         break
        case 'total_amount': av = a.c.total_amount;     bv = b.c.total_amount;     break
        case 'fact':         av = a.fact;               bv = b.fact;               break
        case 'pct':          av = a.pct;                bv = b.pct;                break
        case 'award_date':   av = a.c.award_date ?? ''; bv = b.c.award_date ?? ''; break
        case 'end_date':     av = a.c.end_date ?? '';   bv = b.c.end_date ?? '';   break
        default:             av = '';                    bv = ''
      }
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [ctrRows, invoiceAlertFilter, sortBy, sortDir])

  const hasData = accessibleBudgetLines.length > 0 || accessibleContracts.length > 0

  return (
    <div className="ef-page">

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="ef-filter-bar">
        {/* Ano — zone 3 (1fr) */}
        <div className="ef-filter-zone">
          <MultiSelect
            label="Ano"
            options={yearOptions}
            placeholder="Todos os anos"
            value={selectedYears}
            onChange={setSelectedYears}
          />
        </div>

        {/* Tipo — zone 4 (auto) */}
        <div className="ef-type-toggle">
          {(['todos', 'capex', 'opex'] as TipoFilter[]).map(t => (
            <button
              key={t}
              className={`ef-type-btn${tipoFilter === t ? ' active' : ''}`}
              onClick={() => setTipoFilter(t)}
            >
              {t === 'todos' ? 'Todos' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Spinner />
        </div>
      ) : !hasData ? (
        <EmptyState
          icon="data"
          title="Sem dados financeiros"
          description="Não existem dados financeiros para os filtros seleccionados."
          actionLabel="Ir para Gestão Financeira"
          actionHref="/budget"
        />
      ) : (
        <>
          {/* ── Row 1: Primary KPIs ──────────────────────────────── */}
          <div className="ef-kpi-row-primary">
            <div className="ef-kpi-card-primary">
              <div className="ef-kpi-label t-label">Orçamento Total</div>
              <div className="ef-kpi-value-primary t-headline-sm t-tabular" style={{ color: 'var(--navy)' }}>{fmt(kpiOrc)}</div>
            </div>

            <div className="ef-kpi-card-primary">
              <div className="ef-kpi-label t-label">Comprometido</div>
              <div className="ef-kpi-value-primary t-headline-sm t-tabular" style={{ color: 'var(--blue)' }}>{fmt(kpiAdj)}</div>
              {kpiOrc > 0 && (
                <div className="ef-kpi-sub">{fmtPct(kpiAdj / kpiOrc * 100)} do orçamento</div>
              )}
            </div>

            <div className="ef-kpi-card-primary">
              <div className="ef-kpi-label t-label">Disponível</div>
              <div className="ef-kpi-value-primary t-headline-sm t-tabular" style={{ color: kpiDisp >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(kpiDisp)}
              </div>
              {kpiOrc > 0 && (
                <div className="ef-kpi-sub">{fmtPct(kpiDisp / kpiOrc * 100)} do orçamento</div>
              )}
            </div>
          </div>

          {/* ── Row 2: Secondary KPIs ─────────────────────────────── */}
          <div className="ef-kpi-row-secondary">
            <div className="ef-kpi-card-secondary">
              {(overdueCount > 0 || dueSoonCount > 0) && (
                <div className="ef-alert-badges">
                  {overdueCount > 0 && (
                    <button
                      className={`ef-alert-badge overdue${invoiceAlertFilter === 'overdue' ? ' active' : ''}`}
                      onClick={() => setInvoiceAlertFilter(f => f === 'overdue' ? null : 'overdue')}
                    >
                      {overdueCount} atrasadas
                    </button>
                  )}
                  {dueSoonCount > 0 && (
                    <button
                      className={`ef-alert-badge due-soon${invoiceAlertFilter === 'due_soon' ? ' active' : ''}`}
                      onClick={() => setInvoiceAlertFilter(f => f === 'due_soon' ? null : 'due_soon')}
                    >
                      {dueSoonCount} a vencer
                    </button>
                  )}
                </div>
              )}
              <div className="ef-kpi-label t-label">Facturado</div>
              <div className="ef-kpi-value-secondary" style={{ color: 'var(--amber)' }}>{fmt(kpiFact)}</div>
              {kpiAdj > 0 && (
                <div className="ef-kpi-sub">{fmtPct(kpiFact / kpiAdj * 100)} do comprometido</div>
              )}
            </div>

            <div className="ef-kpi-card-secondary">
              <div className="ef-kpi-label t-label">Pago</div>
              <div className="ef-kpi-value-secondary" style={{ color: 'var(--green)' }}>{fmt(kpiPago)}</div>
              {kpiFact > 0 && (
                <div className="ef-kpi-sub">{fmtPct(kpiPago / kpiFact * 100)} do facturado</div>
              )}
            </div>

            <div className="ef-kpi-card-secondary">
              <div className="ef-kpi-label t-label">Por Facturar</div>
              <div className="ef-kpi-value-secondary" style={{ color: 'var(--text2)' }}>{fmt(kpiPorFact)}</div>
              {kpiAdj > 0 && (
                <div className="ef-kpi-sub">{fmtPct(kpiPorFact / kpiAdj * 100)} do comprometido</div>
              )}
            </div>
          </div>

          {/* ── Row 1: Visão Geral + CAPEX/OPEX ────────────────── */}
          <div className="ef-charts-row-2col">
            <Card title="Visão Geral">
              <VisaoGeralChart data={visaoGeralData} sym={currSymbol} />
            </Card>
            <Card title="CAPEX / OPEX">
              <CapexOpexDonut data={pieData} sym={currSymbol} />
            </Card>
          </div>

          {/* ── Row 2: Execução Mensal (full width) ─────────────── */}
          <div className="ef-charts-row-full">
            <Card title="Execução Mensal">
              <MonthlyStatusChart data={monthlyStatusData} sym={currSymbol} />
            </Card>
          </div>

          {/* ── Row 3: Burn Rate + Top Fornecedores ─────────────── */}
          <div className="ef-charts-row-2col">
            <Card title="Burn Rate">
              <BurnRateChart data={burnRateData} sym={currSymbol} />
            </Card>
            <Card title="Top Fornecedores">
              <TopFornecedoresChart data={topFornecedoresData} sym={currSymbol} />
            </Card>
          </div>

          {/* ── Detail tabs ──────────────────────────────────────── */}
          <Card className="ef-detail-card">
            <div className="ef-detail-tabs">
              <button
                className={`ef-detail-tab${detailTab === 'rubricas' ? ' active' : ''}`}
                onClick={() => setDetailTab('rubricas')}
              >
                Rubricas
              </button>
              <button
                className={`ef-detail-tab${detailTab === 'contratos' ? ' active' : ''}`}
                onClick={() => setDetailTab('contratos')}
              >
                Contratos
                {ctrRows.length > 0 && (
                  <span className="ef-tab-count">{ctrRows.length}</span>
                )}
              </button>
            </div>

            <div className="ef-detail-body">
              {detailTab === 'rubricas' && (
                catRows.length === 0 ? (
                  <p className="ef-empty">Sem linhas orçamentais.</p>
                ) : (
                  <table className="ef-table ef-detail-table">
                    <colgroup>
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '10%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Rubrica</th>
                        <th>Tipo</th>
                        <th className="ef-th-r">Orçamento</th>
                        <th className="ef-th-r">Comprometido</th>
                        <th className="ef-th-r">Facturado</th>
                        <th className="ef-th-r">Pago</th>
                        <th className="ef-th-r">Disponível</th>
                        <th>% Facturado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catRows.map(r => (
                        <tr key={r.cat}>
                          <td title={r.cat}>{r.cat}</td>
                          <td>
                            <span className={`ef-tipo-badge ${r.isCapex ? 'ef-tipo-badge--capex' : 'ef-tipo-badge--opex'}`}>
                              {r.isCapex ? 'CAPEX' : 'OPEX'}
                            </span>
                          </td>
                          <td className="ef-td-r">{fmt(r.orc)}</td>
                          <td className="ef-td-r">{fmt(r.adj)}</td>
                          <td className="ef-td-r">{fmt(r.fact)}</td>
                          <td className="ef-td-r">{fmt(r.pago)}</td>
                          <td className={`ef-td-r ${r.disp < 0 ? 'ef-red' : ''}`}>{fmt(Math.max(0, r.disp))}</td>
                          <td><ProgressCell pct={r.pctFact} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="ef-total">
                        <td>Total</td>
                        <td />
                        <td className="ef-td-r">{fmt(catRows.reduce((s, r) => s + r.orc, 0))}</td>
                        <td className="ef-td-r">{fmt(catRows.reduce((s, r) => s + r.adj, 0))}</td>
                        <td className="ef-td-r">{fmt(catRows.reduce((s, r) => s + r.fact, 0))}</td>
                        <td className="ef-td-r">{fmt(catRows.reduce((s, r) => s + r.pago, 0))}</td>
                        <td className="ef-td-r">{fmt(Math.max(0, catRows.reduce((s, r) => s + r.disp, 0)))}</td>
                        <td><ProgressCell pct={kpiAdj > 0 ? kpiFact / kpiAdj * 100 : 0} /></td>
                      </tr>
                    </tfoot>
                  </table>
                )
              )}

              {detailTab === 'contratos' && (
                <>
                  {(overdueCount > 0 || dueSoonCount > 0) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Filtrar:</span>
                      {overdueCount > 0 && (
                        <button
                          className={`ef-alert-badge overdue${invoiceAlertFilter === 'overdue' ? ' active' : ''}`}
                          onClick={() => setInvoiceAlertFilter(f => f === 'overdue' ? null : 'overdue')}
                        >
                          {overdueCount} atrasadas
                        </button>
                      )}
                      {dueSoonCount > 0 && (
                        <button
                          className={`ef-alert-badge due-soon${invoiceAlertFilter === 'due_soon' ? ' active' : ''}`}
                          onClick={() => setInvoiceAlertFilter(f => f === 'due_soon' ? null : 'due_soon')}
                        >
                          {dueSoonCount} a vencer
                        </button>
                      )}
                    </div>
                  )}
                  {sortedCtrRows.length === 0 ? (
                    <p className="ef-empty">Sem contratos.</p>
                  ) : (
                    <table className="ef-table ef-detail-table">
                      <colgroup>
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '7%' }} />
                        <col style={{ width: '6%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '9%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="ef-th-sort" onClick={() => handleSort('supplier')}>Fornecedor{arrow('supplier')}</th>
                          <th className="ef-th-sort" onClick={() => handleSort('category')}>Categoria{arrow('category')}</th>
                          <th>Tipo</th>
                          <th className="ef-th-sort" onClick={() => handleSort('currency')}>Moeda{arrow('currency')}</th>
                          <th className="ef-th-r ef-th-sort" onClick={() => handleSort('total_amount')}>Comprometido{arrow('total_amount')}</th>
                          <th className="ef-th-r ef-th-sort" onClick={() => handleSort('fact')}>Facturado{arrow('fact')}</th>
                          <th>% Facturado</th>
                          <th className="ef-th-c ef-th-sort" onClick={() => handleSort('award_date')}>Data Adj.{arrow('award_date')}</th>
                          <th className="ef-th-c ef-th-sort" onClick={() => handleSort('end_date')}>Data Fim{arrow('end_date')}</th>
                          <th className="ef-th-c">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCtrRows.map(({ c, fact, pct, isCapex }) => {
                          const { label, variant } = contractEstado(pct)
                          return (
                            <tr key={c.id}>
                              <td title={c.supplier}>{c.supplier}</td>
                              <td title={c.category}>{c.category}</td>
                              <td>
                                <span className={`ef-tipo-badge ${isCapex ? 'ef-tipo-badge--capex' : 'ef-tipo-badge--opex'}`}>
                                  {isCapex ? 'CAPEX' : 'OPEX'}
                                </span>
                              </td>
                              <td>{c.currency}</td>
                              <td className="ef-td-r">{fmt(c.total_amount)}</td>
                              <td className="ef-td-r">{fmt(fact)}</td>
                              <td><ProgressCell pct={pct} /></td>
                              <td className="ef-td-c">{fmtDate(c.award_date)}</td>
                              <td className="ef-td-c">{fmtDate(c.end_date)}</td>
                              <td className="ef-td-c">
                                <span className={`ef-badge-estado ef-badge-estado--${variant}`}>{label}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
