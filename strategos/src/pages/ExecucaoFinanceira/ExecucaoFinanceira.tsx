import './ExecucaoFinanceira.css'
import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import Card from '../../components/Card/Card'
import KpiCard from '../../components/KpiCard/KpiCard'
import Badge from '../../components/Badge/Badge'
import { useFinancials } from '../../hooks/useFinancials'
import { usePdsEntries } from '../../hooks/usePdsEntries'
import { useFilters } from '../../context/FilterContext'

// ── Helpers ────────────────────────────────────────────────────
function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((s, v) => s + v, 0)
}

function fmtEur(val: number): string {
  return val.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
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

function CapexOpexChart({ data }: { data: PieEntry[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <p className="ef-empty">Sem dados orçamentais.</p>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={56} outerRadius={90}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Pie>
        <Tooltip
          formatter={(v) => fmtEur(v as number)}
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

function MonthlyChart({ data }: { data: MonthBar[] }) {
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
          formatter={(v) => fmtEur(v as number)}
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
function contractEstado(pct: number): { label: string; variant: 'grey' | 'amber' | 'green' } {
  if (pct <= 0)   return { label: 'Não iniciado', variant: 'grey' }
  if (pct >= 100) return { label: 'Concluído',    variant: 'green' }
  return                  { label: 'Em execução',  variant: 'amber' }
}

// ── Main page ──────────────────────────────────────────────────
export default function ExecucaoFinanceira() {
  const { filters } = useFilters()
  const programId   = filters.programIds[0]

  const { budgetLines, contracts, invoices, loading } = useFinancials(programId)
  const { entries }                                   = usePdsEntries(programId)

  const [planKey, setPlanKey] = useState('')

  // ── Plan selector options ────────────────────────────────────
  const planOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { key: string; label: string }[] = []
    for (const e of entries) {
      const k = `${e.program_id}|${e.n0}|${e.n1}`
      if (!seen.has(k)) {
        seen.add(k)
        const parts = [e.n0, e.plan_name || e.n1].filter(Boolean)
        opts.push({ key: k, label: parts.join(' › ') })
      }
    }
    return opts
  }, [entries])

  // ── Entry IDs for selected plan (null = all plans) ───────────
  const planIds = useMemo<Set<string> | null>(() => {
    if (!planKey) return null
    const [pid, n0, n1] = planKey.split('|')
    return new Set(
      entries
        .filter(e => String(e.program_id) === pid && e.n0 === n0 && e.n1 === n1)
        .map(e => e.id)
    )
  }, [entries, planKey])

  // ── Scoped data ──────────────────────────────────────────────
  const lines = useMemo(
    () => planIds ? budgetLines.filter(l => planIds.has(l.pds_id)) : budgetLines,
    [budgetLines, planIds]
  )
  const ctrs = useMemo(
    () => planIds ? contracts.filter(c => planIds.has(c.pds_id)) : contracts,
    [contracts, planIds]
  )
  const invs = useMemo(
    () => planIds ? invoices.filter(i => planIds.has(i.pds_id)) : invoices,
    [invoices, planIds]
  )

  // ── KPIs ─────────────────────────────────────────────────────
  const kpiOrc   = useMemo(() => lines.reduce((s, l) => s + sumValues(l.values), 0), [lines])
  const kpiExec  = useMemo(() => invs.filter(i => i.status === 'Pago').reduce((s, i) => s + i.amount, 0), [invs])
  const kpiCompr = useMemo(() => ctrs.reduce((s, c) => s + c.total_amount, 0), [ctrs])
  const kpiEmPag = useMemo(
    () => invs.filter(i => i.status === 'Recebida' || i.status === 'Em pagamento').reduce((s, i) => s + i.amount, 0),
    [invs]
  )
  const kpiDesvio = kpiCompr - kpiOrc

  // ── CAPEX / OPEX pie ─────────────────────────────────────────
  const pieData = useMemo<PieEntry[]>(() => [
    { name: 'CAPEX', value: lines.filter(l => l.capex).reduce((s, l) => s + sumValues(l.values), 0),  fill: '#185FA5' },
    { name: 'OPEX',  value: lines.filter(l => !l.capex).reduce((s, l) => s + sumValues(l.values), 0), fill: '#95BB42' },
  ], [lines])

  // ── Monthly bar ──────────────────────────────────────────────
  const monthlyData = useMemo<MonthBar[]>(() => {
    const map = new Map<string, { p: number; e: number; o: number }>()
    for (const inv of invs) {
      const ds = inv.issue_date ?? inv.due_date
      if (!ds) continue
      const key = ds.substring(0, 7)
      const row = map.get(key) ?? { p: 0, e: 0, o: 0 }
      if (inv.status === 'Pago') row.p += inv.amount
      else if (inv.status === 'Recebida' || inv.status === 'Em pagamento') row.e += inv.amount
      else row.o += inv.amount
      map.set(key, row)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, Pago: v.p, 'Em pagamento': v.e, 'Por facturar': v.o }))
  }, [invs])

  // ── Category execution rows ───────────────────────────────────
  const catMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of ctrs) m.set(c.id, c.category)
    return m
  }, [ctrs])

  const catRows = useMemo(() => {
    const cats = [...new Set(lines.map(l => l.category))].sort()
    return cats.map(cat => {
      const orc  = lines.filter(l => l.category === cat).reduce((s, l) => s + sumValues(l.values), 0)
      const exec = invs
        .filter(i => i.status === 'Pago' && catMap.get(i.contract_id ?? '') === cat)
        .reduce((s, i) => s + i.amount, 0)
      return { cat, orc, exec, pct: orc > 0 ? exec / orc * 100 : 0, desvio: exec - orc }
    })
  }, [lines, invs, catMap])

  // ── Contract rows ─────────────────────────────────────────────
  const ctrRows = useMemo(() => ctrs.map(c => {
    const fact = invs.filter(i => i.contract_id === c.id).reduce((s, i) => s + i.amount, 0)
    return { c, fact, pct: c.total_amount > 0 ? fact / c.total_amount * 100 : 0 }
  }), [ctrs, invs])

  const hasData = budgetLines.length > 0 || contracts.length > 0

  return (
    <div className="ef-page">

      {/* Plan selector */}
      <div className="ef-selector-bar">
        <span className="ef-selector-label">Plano</span>
        <select
          className="ef-selector-select"
          value={planKey}
          onChange={e => setPlanKey(e.target.value)}
        >
          <option value="">Todos os planos</option>
          {planOptions.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="ef-empty-page">A carregar…</div>
      ) : !hasData ? (
        <div className="ef-empty-page">Sem dados financeiros carregados.</div>
      ) : (
        <>
          {/* KPI row */}
          <div className="ef-kpi-row">
            <KpiCard label="Orçamento total" value={fmtEur(kpiOrc)} color="navy" />
            <KpiCard
              label="Executado"
              value={fmtEur(kpiExec)}
              subtitle={kpiOrc > 0 ? fmtPct(kpiExec / kpiOrc * 100) + ' do orçamento' : undefined}
              color="green"
            />
            <KpiCard label="Comprometido" value={fmtEur(kpiCompr)} color="blue" />
            <KpiCard label="Em pagamento" value={fmtEur(kpiEmPag)} color="amber" />
            <KpiCard
              label="Desvio"
              value={fmtEur(Math.abs(kpiDesvio))}
              subtitle={kpiDesvio > 0 ? 'acima do orçamento' : kpiDesvio < 0 ? 'abaixo do orçamento' : 'em linha'}
              color={kpiDesvio > 0 ? 'red' : kpiDesvio < 0 ? 'green' : 'text'}
            />
          </div>

          {/* Charts row */}
          <div className="ef-charts-row">
            <Card title="Execução por tipo">
              <CapexOpexChart data={pieData} />
            </Card>
            <Card title="Execução mensal">
              <MonthlyChart data={monthlyData} />
            </Card>
          </div>

          {/* Rubrica execution table */}
          <Card title="Execução por rubrica">
            {catRows.length === 0 ? (
              <p className="ef-empty">Sem linhas orçamentais.</p>
            ) : (
              <table className="ef-table">
                <thead>
                  <tr>
                    <th>Rubrica</th>
                    <th className="ef-th-r">Orçamento</th>
                    <th className="ef-th-r">Executado</th>
                    <th className="ef-th-c">% Execução</th>
                    <th className="ef-th-r">Desvio</th>
                  </tr>
                </thead>
                <tbody>
                  {catRows.map(r => (
                    <tr key={r.cat}>
                      <td>{r.cat}</td>
                      <td className="ef-td-r">{fmtEur(r.orc)}</td>
                      <td className="ef-td-r">{fmtEur(r.exec)}</td>
                      <td className="ef-td-c">{fmtPct(r.pct)}</td>
                      <td className={`ef-td-r ${r.desvio > 0 ? 'ef-red' : r.desvio < 0 ? 'ef-grn' : ''}`}>
                        {r.desvio > 0 ? '+' : r.desvio < 0 ? '–' : ''}{fmtEur(Math.abs(r.desvio))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="ef-total">
                    <td>Total</td>
                    <td className="ef-td-r">{fmtEur(catRows.reduce((s, r) => s + r.orc, 0))}</td>
                    <td className="ef-td-r">{fmtEur(catRows.reduce((s, r) => s + r.exec, 0))}</td>
                    <td className="ef-td-c">{fmtPct(kpiOrc > 0 ? kpiExec / kpiOrc * 100 : 0)}</td>
                    <td className="ef-td-r">{fmtEur(Math.abs(catRows.reduce((s, r) => s + r.desvio, 0)))}</td>
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
                    <th className="ef-th-r">Valor Total</th>
                    <th className="ef-th-r">Facturado</th>
                    <th className="ef-th-c">% Facturado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ctrRows.map(({ c, fact, pct }) => {
                    const { label, variant } = contractEstado(pct)
                    return (
                      <tr key={c.id}>
                        <td>{c.supplier}</td>
                        <td>{c.category}</td>
                        <td className="ef-td-r">{fmtEur(c.total_amount)}</td>
                        <td className="ef-td-r">{fmtEur(fact)}</td>
                        <td className="ef-td-c">{fmtPct(pct)}</td>
                        <td><Badge variant={variant}>{label}</Badge></td>
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
