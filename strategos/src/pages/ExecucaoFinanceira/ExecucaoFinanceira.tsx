import './ExecucaoFinanceira.css'
import { useState, useMemo, useEffect } from 'react'
import Spinner from '../../components/Spinner/Spinner'
import MultiSelect from '../../components/MultiSelect/MultiSelect'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import Card from '../../components/Card/Card'
import KpiCard from '../../components/KpiCard/KpiCard'
import { useFinancials } from '../../hooks/useFinancials'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import { useFilters } from '../../context/FilterContext'
import { supabase } from '../../lib/supabase'

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
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('pt-PT', {
    month: 'short', year: '2-digit',
  })
}

// ── CAPEX / OPEX donut ─────────────────────────────────────────
interface PieEntry { name: string; value: number; fill: string }

function CapexOpexChart({ data, sym }: { data: PieEntry[]; sym: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <p className="ef-empty">Sem dados orçamentais.</p>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={56} outerRadius={90}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Pie>
        <Tooltip
          formatter={(v) => fmtEur(v as number, sym)}
          contentStyle={{ fontSize: 12, border: '1px solid var(--border2)' }}
        />
        <Legend
          formatter={(name: string) => {
            const d = data.find(e => e.name === name)
            const pct = d && total > 0 ? ` (${(d.value / total * 100).toFixed(1)}%)` : ''
            return name + pct
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Monthly stacked bar ────────────────────────────────────────
interface MonthBar {
  month: string
  Pago: number
  'Em pagamento': number
  'Por facturar': number
}

function MonthlyChart({ data, sym }: { data: MonthBar[]; sym: string }) {
  if (data.length === 0) return <p className="ef-empty">Sem facturas com datas.</p>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(v: string) => fmtMonth(String(v))}
          tick={{ fontSize: 10 }}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
          width={44}
        />
        <Tooltip
          formatter={(v) => fmtEur(v as number, sym)}
          labelFormatter={(label: string) => fmtMonth(String(label))}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Pago"           stackId="s" fill="#95BB42" />
        <Bar dataKey="Em pagamento"   stackId="s" fill="#D97706" />
        <Bar dataKey="Por facturar"   stackId="s" fill="#9c9c96" />
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
  const { programs } = usePrograms()

  const [selProgId,           setSelProgId]           = useState<string | null>(null)
  const [selectedPlanoLabels, setSelectedPlanoLabels] = useState<string[]>([])
  const [selectedYears,       setSelectedYears]       = useState<string[]>([])
  const [tipoFilter,          setTipoFilter]          = useState<TipoFilter>('todos')
  const [currSymbol,          setCurrSymbol]          = useState('€')
  const [mgmtYears,           setMgmtYears]           = useState<string[]>([])

  // Initialise program from global filter or first program
  useEffect(() => {
    if (programs.length === 0) return
    setSelProgId(prev => {
      if (prev && programs.some(p => p.id === prev)) return prev
      return filters.programIds[0] ?? programs[0].id
    })
  }, [programs, filters.programIds])

  // Reset plano/year selection when program changes
  useEffect(() => {
    setSelectedPlanoLabels([])
    setSelectedYears([])
  }, [selProgId])

  // Fetch default currency symbol
  useEffect(() => {
    supabase.from('currencies').select('symbol').eq('is_default', true).limit(1)
      .then(({ data }) => { if (data?.[0]?.symbol) setCurrSymbol(data[0].symbol) })
  }, [])

  // Fetch management years for the selected program
  useEffect(() => {
    if (!selProgId) { setMgmtYears([]); return }
    let cancelled = false
    supabase
      .from('management_years')
      .select('year')
      .eq('program_id', selProgId)
      .order('year')
      .then(({ data }) => {
        if (cancelled) return
        setMgmtYears(data?.map(r => String(r.year)) ?? [])
      })
    return () => { cancelled = true }
  }, [selProgId])

  const programId = selProgId ?? undefined

  const { budgetLines, contracts, invoices, loading } = useFinancials(programId)
  const { planos }                                    = usePlanos(programId)

  // ── Plano options (label → id mapping) ──────────────────────
  const planoOptions = useMemo(() =>
    planos.map(p => p.eixo?.name ? `${p.eixo.name} > ${p.name}` : p.name),
    [planos]
  )

  const planoLabelToId = useMemo(() => {
    const m = new Map<string, string>()
    planos.forEach((p, i) => m.set(planoOptions[i], p.id))
    return m
  }, [planos, planoOptions])

  const selectedPlanoIds = useMemo(() =>
    selectedPlanoLabels.flatMap(l => {
      const id = planoLabelToId.get(l)
      return id ? [id] : []
    }),
    [selectedPlanoLabels, planoLabelToId]
  )

  // ── Year options (management_years, fallback to budget line keys) ─
  const yearOptions = useMemo(() => {
    if (mgmtYears.length > 0) return mgmtYears
    const years = new Set<string>()
    for (const l of budgetLines) {
      for (const key of Object.keys(l.values)) years.add(key.split('-')[0])
    }
    return [...years].sort()
  }, [mgmtYears, budgetLines])

  // ── Step 1: plano-filtered data ──────────────────────────────
  const planLines = useMemo(() =>
    selectedPlanoIds.length > 0
      ? budgetLines.filter(l => l.plano_id !== null && selectedPlanoIds.includes(l.plano_id))
      : budgetLines,
    [budgetLines, selectedPlanoIds]
  )
  const planCtrs = useMemo(() =>
    selectedPlanoIds.length > 0
      ? contracts.filter(c => c.plano_id !== null && selectedPlanoIds.includes(c.plano_id))
      : contracts,
    [contracts, selectedPlanoIds]
  )
  const planInvs = useMemo(() =>
    selectedPlanoIds.length > 0
      ? invoices.filter(i => i.plano_id !== null && selectedPlanoIds.includes(i.plano_id))
      : invoices,
    [invoices, selectedPlanoIds]
  )

  // Category → isCapex map (based on all plano lines, ignoring tipo chip)
  const catCapexMap = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const l of planLines) {
      if (!m.has(l.category)) m.set(l.category, l.capex)
    }
    return m
  }, [planLines])

  // ── Step 2: CAPEX/OPEX filter ────────────────────────────────
  const lines = useMemo(() => {
    if (tipoFilter === 'todos') return planLines
    return planLines.filter(l => tipoFilter === 'capex' ? l.capex : !l.capex)
  }, [planLines, tipoFilter])

  const ctrs = useMemo(() => {
    if (tipoFilter === 'todos') return planCtrs
    const catSet = new Set(lines.map(l => l.category))
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
    () => invs.filter(i => i.status !== 'Rejeitada').reduce((s, i) => s + i.amount, 0),
    [invs]
  )
  const kpiPago    = useMemo(() => invs.filter(i => i.status === 'Paga').reduce((s, i) => s + i.amount, 0), [invs])
  const kpiPorFact = kpiAdj - kpiFact
  const kpiDisp    = kpiOrc - kpiAdj
  const fmt        = (v: number) => fmtEur(v, currSymbol)

  // ── CAPEX / OPEX pie ─────────────────────────────────────────
  const pieData = useMemo<PieEntry[]>(() => [
    { name: 'CAPEX', value: lines.filter(l =>  l.capex).reduce((s, l) => s + sumByYears(l.values, selectedYears), 0), fill: '#185FA5' },
    { name: 'OPEX',  value: lines.filter(l => !l.capex).reduce((s, l) => s + sumByYears(l.values, selectedYears), 0), fill: '#95BB42' },
  ], [lines, selectedYears])

  // ── Monthly bar ───────────────────────────────────────────────
  const monthlyData = useMemo<MonthBar[]>(() => {
    const yearInvs = selectedYears.length > 0
      ? invs.filter(i => selectedYears.some(y => (i.issue_date ?? i.due_date ?? '').startsWith(y)))
      : invs
    const map = new Map<string, { p: number; e: number; o: number }>()
    for (const inv of yearInvs) {
      const ds = inv.issue_date ?? inv.due_date
      if (!ds) continue
      const key = ds.substring(0, 7)
      const row = map.get(key) ?? { p: 0, e: 0, o: 0 }
      if (inv.status === 'Rejeitada') continue
      if (inv.status === 'Paga') row.p += inv.amount
      else if (inv.status === 'Recebida' || inv.status === 'Aprovada') row.e += inv.amount
      else row.o += inv.amount
      map.set(key, row)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, Pago: v.p, 'Em pagamento': v.e, 'Por facturar': v.o }))
  }, [invs, selectedYears])

  // ── Category rows ─────────────────────────────────────────────
  const catRows = useMemo(() => {
    const cats = [...new Set(lines.map(l => l.category))].sort()
    return cats.map(cat => {
      const catLines = lines.filter(l => l.category === cat)
      const orc      = catLines.reduce((s, l) => s + sumByYears(l.values, selectedYears), 0)
      const isCapex  = catLines.some(l => l.capex)
      const adj      = ctrs.filter(c => c.category === cat).reduce((s, c) => s + c.total_amount, 0)
      const pctAdj   = orc > 0 ? adj / orc * 100 : 0
      const disp     = orc - adj
      return { cat, isCapex, orc, adj, pctAdj, disp }
    })
  }, [lines, ctrs, selectedYears])

  // ── Contract rows ─────────────────────────────────────────────
  const ctrRows = useMemo(() => ctrs.map(c => {
    const fact    = invs
      .filter(i => (i.contract_id === c.id || i.app_contract_id === c.app_id) && i.status !== 'Rejeitada')
      .reduce((s, i) => s + i.amount, 0)
    const isCapex = catCapexMap.get(c.category) ?? false
    return { c, fact, pct: c.total_amount > 0 ? fact / c.total_amount * 100 : 0, isCapex }
  }), [ctrs, invs, catCapexMap])

  const hasData = budgetLines.length > 0 || contracts.length > 0

  return (
    <div className="ef-page">

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="ef-filter-bar">
        {/* Programa — zone 1 (1fr) */}
        <div className="ef-filter-zone">
          <select
            className="styled-select"
            value={selProgId ?? ''}
            onChange={e => setSelProgId(e.target.value || null)}
          >
            {programs.length > 1 && <option value="">Todos os programas</option>}
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Plano — zone 2 (1.5fr) */}
        <div className="ef-filter-zone">
          <MultiSelect
            label="Plano"
            options={planoOptions}
            placeholder="Todos os planos"
            value={selectedPlanoLabels}
            onChange={setSelectedPlanoLabels}
          />
        </div>

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
        <div className="ef-empty-page">Sem dados financeiros carregados.</div>
      ) : (
        <>
          {/* KPI row — 6 cards */}
          <div className="ef-kpi-row">
            <KpiCard label="Orçamento Total" value={fmt(kpiOrc)} color="navy" />
            <KpiCard
              label="Adjudicado"
              value={fmt(kpiAdj)}
              subtitle={kpiOrc > 0 ? fmtPct(kpiAdj / kpiOrc * 100) + ' do orçamento' : undefined}
              color="blue"
            />
            <KpiCard
              label="Facturado"
              value={fmt(kpiFact)}
              subtitle={kpiAdj > 0 ? fmtPct(kpiFact / kpiAdj * 100) + ' do adjudicado' : undefined}
              color="amber"
            />
            <KpiCard
              label="Pago"
              value={fmt(kpiPago)}
              subtitle={kpiFact > 0 ? fmtPct(kpiPago / kpiFact * 100) + ' do facturado' : undefined}
              color="green"
            />
            <KpiCard
              label="Por Facturar"
              value={fmt(Math.max(0, kpiPorFact))}
              subtitle={kpiAdj > 0 ? fmtPct(Math.max(0, kpiPorFact) / kpiAdj * 100) + ' do adjudicado' : undefined}
              color="red"
            />
            <KpiCard
              label="Orçamento Disponível"
              value={fmt(Math.max(0, kpiDisp))}
              subtitle={kpiOrc > 0 ? fmtPct(Math.max(0, kpiDisp) / kpiOrc * 100) + ' do orçamento' : undefined}
              color="text"
            />
          </div>

          {/* Charts row */}
          <div className="ef-charts-row">
            <Card title="Execução mensal">
              <MonthlyChart data={monthlyData} sym={currSymbol} />
            </Card>
            <Card title="Execução por tipo">
              <CapexOpexChart data={pieData} sym={currSymbol} />
            </Card>
          </div>

          {/* Rubricas table */}
          <Card title="Execução por rubrica">
            {catRows.length === 0 ? (
              <p className="ef-empty">Sem linhas orçamentais.</p>
            ) : (
              <table className="ef-table">
                <thead>
                  <tr>
                    <th>Rubrica</th>
                    <th>Tipo</th>
                    <th className="ef-th-r">Orçamento</th>
                    <th className="ef-th-r">Adjudicado</th>
                    <th className="ef-th-c">% Adj.</th>
                    <th className="ef-th-r">Disponível</th>
                  </tr>
                </thead>
                <tbody>
                  {catRows.map(r => (
                    <tr key={r.cat}>
                      <td>{r.cat}</td>
                      <td>
                        <span className={`ef-tipo-badge ${r.isCapex ? 'ef-tipo-badge--capex' : 'ef-tipo-badge--opex'}`}>
                          {r.isCapex ? 'CAPEX' : 'OPEX'}
                        </span>
                      </td>
                      <td className="ef-td-r">{fmt(r.orc)}</td>
                      <td className="ef-td-r">{fmt(r.adj)}</td>
                      <td className="ef-td-c">{fmtPct(r.pctAdj)}</td>
                      <td className={`ef-td-r ${r.disp < 0 ? 'ef-red' : ''}`}>{fmt(Math.max(0, r.disp))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="ef-total">
                    <td>Total</td>
                    <td />
                    <td className="ef-td-r">{fmt(catRows.reduce((s, r) => s + r.orc, 0))}</td>
                    <td className="ef-td-r">{fmt(catRows.reduce((s, r) => s + r.adj, 0))}</td>
                    <td className="ef-td-c">{fmtPct(kpiOrc > 0 ? kpiAdj / kpiOrc * 100 : 0)}</td>
                    <td className="ef-td-r">{fmt(Math.max(0, catRows.reduce((s, r) => s + r.disp, 0)))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </Card>

          {/* Contracts table */}
          {ctrRows.length > 0 && (
            <Card title="Contratos">
              <table className="ef-table">
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th>Categoria</th>
                    <th>Tipo</th>
                    <th className="ef-th-r">Adjudicado</th>
                    <th className="ef-th-r">Facturado</th>
                    <th className="ef-th-c">% Facturado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ctrRows.map(({ c, fact, pct, isCapex }) => {
                    const { label, variant } = contractEstado(pct)
                    return (
                      <tr key={c.id}>
                        <td>{c.supplier}</td>
                        <td>{c.category}</td>
                        <td>
                          <span className={`ef-tipo-badge ${isCapex ? 'ef-tipo-badge--capex' : 'ef-tipo-badge--opex'}`}>
                            {isCapex ? 'CAPEX' : 'OPEX'}
                          </span>
                        </td>
                        <td className="ef-td-r">{fmt(c.total_amount)}</td>
                        <td className="ef-td-r">{fmt(fact)}</td>
                        <td className="ef-td-c">{fmtPct(pct)}</td>
                        <td>
                          <span className={`status-pill ef-badge-estado ef-badge-estado--${variant}`}>{label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
