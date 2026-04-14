import './Dashboard.css'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList,
  LineChart, Line,
} from 'recharts'
import Card from '../../components/Card/Card'
import KpiCard from '../../components/KpiCard/KpiCard'
import Table, { type Column } from '../../components/Table/Table'
import { useActivities } from '../../hooks/useActivities'
import { usePrograms } from '../../hooks/usePrograms'
import { useSnapshots } from '../../hooks/useSnapshots'
import { useFilters } from '../../context/FilterContext'
import type { Activity } from '../../types/index'
import { leafPctPrev, leafStatus } from '../../lib/rollup'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Chart colours ─────────────────────────────────────────────
const CLR_CONCLUIDAS = '#95BB42'
const CLR_EM_DIA     = '#002E5E'
const CLR_EM_ATRASO  = '#E24B4A'

// ── Pie slice label ───────────────────────────────────────────
interface PieLabelProps {
  cx: number; cy: number; midAngle: number
  innerRadius: number; outerRadius: number; percent: number
}
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieLabelProps) {
  if (percent < 0.05) return null
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * (Math.PI / 180))
  const y = cy + r * Math.sin(-midAngle * (Math.PI / 180))
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 600, pointerEvents: 'none' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ── Types ─────────────────────────────────────────────────────
type EvoMetric = 'grau_exec' | 'conc_geral' | 'conc_data'

// ── Metric helpers ────────────────────────────────────────────
interface Metrics {
  total: number
  concluidas: number
  em_dia: number
  em_atraso: number
  /** Average pct (0–100) */
  grau_exec: number
  /** Average pct_prev (0–100) */
  exec_obj: number
}

function classify(a: Activity): 'concluida' | 'em_dia' | 'em_atraso' {
  const s = leafStatus(a, TODAY)
  if (s === 'Concluída') return 'concluida'
  if (s === 'Em atraso') return 'em_atraso'
  return 'em_dia'
}

function calcMetrics(acts: Activity[]): Metrics {
  const total = acts.length
  if (total === 0) {
    return { total: 0, concluidas: 0, em_dia: 0, em_atraso: 0, grau_exec: 0, exec_obj: 0 }
  }
  let concluidas = 0, em_dia = 0, em_atraso = 0, sumPct = 0, sumPrev = 0
  for (const a of acts) {
    const cls = classify(a)
    if (cls === 'concluida') concluidas++
    else if (cls === 'em_dia') em_dia++
    else em_atraso++
    sumPct  += a.pct
    sumPrev += leafPctPrev(a, TODAY)
  }
  return {
    total, concluidas, em_dia, em_atraso,
    grau_exec: sumPct  / total,
    exec_obj:  sumPrev / total,
  }
}

function fmtPct(n: number): string { return `${n.toFixed(1)}%` }
function safeDiv(a: number, b: number): number { return b > 0 ? a / b : 0 }

function mkTrend(
  current: number,
  prev: number | null | undefined,
  fmt: (n: number) => string,
  inverted = false,
) {
  if (prev == null) return undefined
  const diff = current - prev
  if (diff === 0) return undefined
  const better = inverted ? diff < 0 : diff > 0
  const color = better ? '#3B6D11' : '#A32D2D'
  return <span style={{ color }}>{diff > 0 ? '▲' : '▼'} {fmt(Math.abs(diff))}</span>
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const existing = map.get(key)
    if (existing) existing.push(item)
    else map.set(key, [item])
  }
  return map
}

function buildRow(nome: string, m: Metrics, isParent: boolean): Record<string, unknown> {
  const concGeral = safeDiv(m.concluidas, m.total) * 100
  const concData  = safeDiv(m.concluidas, m.concluidas + m.em_atraso) * 100
  const cgObj     = safeDiv(m.concluidas + m.em_atraso, m.total) * 100
  return {
    _isParent: isParent,
    nome,
    total:      m.total,
    concluidas: m.concluidas,
    em_dia:     m.em_dia,
    em_atraso:  m.em_atraso,
    grau_exec:  m.total > 0 ? fmtPct(m.grau_exec) : '—',
    exec_obj:   m.total > 0 ? fmtPct(m.exec_obj)  : '—',
    conc_geral: m.total > 0 ? fmtPct(concGeral)   : '—',
    cg_obj:     m.total > 0 ? fmtPct(cgObj)       : '—',
    conc_data:  m.concluidas + m.em_atraso > 0 ? fmtPct(concData) : '—',
    cd_obj:     '100%',
  }
}

// ── Table columns ─────────────────────────────────────────────
const DETAIL_COLS: Column[] = [
  {
    key: 'nome',
    label: 'Designação',
    sortable: false,
    minWidth: '250px',
    render: (_v, row) => (
      <span style={{
        fontWeight: Boolean(row._isTotals) || Boolean(row._isParent) ? 700 : 400,
        color: Boolean(row._isTotals) ? 'var(--navy)' : undefined,
      }}>
        {String(row.nome ?? '')}
      </span>
    ),
  },
  { key: 'total',      label: 'Total',         sortable: true, width: '70px'  },
  { key: 'concluidas', label: 'Concluídas',    sortable: true, width: '90px'  },
  { key: 'em_dia',     label: 'Em dia',        sortable: true, width: '70px'  },
  { key: 'em_atraso',  label: 'Em atraso',     sortable: true, width: '80px'  },
  { key: 'grau_exec',  label: 'Grau Execução', sortable: true, width: '110px' },
  {
    key: 'exec_obj',   label: 'Exec. obj.',    sortable: true, width: '90px',
    headerColor: 'var(--green)',
    render: (v) => <span style={{ color: 'var(--green)' }}>{v as string ?? '—'}</span>,
  },
  { key: 'conc_geral', label: 'Conc. Geral',   sortable: true, width: '100px' },
  {
    key: 'cg_obj',     label: 'C.G.Obj.',      sortable: true, width: '80px',
    headerColor: 'var(--green)',
    render: (v) => <span style={{ color: 'var(--green)' }}>{v as string ?? '—'}</span>,
  },
  { key: 'conc_data',  label: 'Conc. Data',    sortable: true, width: '90px'  },
  {
    key: 'cd_obj',     label: 'C.D.Obj.',      sortable: true, width: '80px',
    headerColor: 'var(--green)',
    render: (v) => <span style={{ color: 'var(--green)' }}>{v as string ?? '—'}</span>,
  },
]

// ── Component ─────────────────────────────────────────────────
export default function Dashboard() {
  const [chip, setChip]           = useState<'eixo' | 'eixo-plano'>('eixo')
  const [evoMetric, setEvoMetric] = useState<EvoMetric>('grau_exec')

  const navigate = useNavigate()
  const { filters, setFilter, getFilteredActivities } = useFilters()
  const { activities, loading }            = useActivities({ cutoffDate: filters.cutoffDate })
  const { programs }                       = usePrograms()
  const snapshotProgramId                  = filters.programIds[0]
  const { snapshots }                      = useSnapshots(snapshotProgramId)

  // Apply global filters then restrict to leaf level (level 4)
  const filtered = useMemo(
    () => getFilteredActivities(activities),
    [activities, getFilteredActivities],
  )
  const leaves = useMemo(() => filtered.filter(a => a.level === 4), [filtered])
  const m      = useMemo(() => calcMetrics(leaves), [leaves])

  // Program scope label (uses programs list)
  const activeProgramCount = useMemo(() => {
    const ids = new Set(
      leaves.map(a => a.program_id).filter((id): id is string => id !== null),
    )
    return ids.size
  }, [leaves])
  const programLabel = programs.length > 0
    ? `${activeProgramCount} / ${programs.length} prog.`
    : undefined

  // ── Derived KPI strings ──────────────────────────────────────
  const kpiGrauExec  = m.total > 0 ? fmtPct(m.grau_exec) : '—'
  const kpiConcGeral = m.total > 0
    ? fmtPct(safeDiv(m.concluidas, m.total) * 100) : '—'
  const kpiConcData  = m.concluidas + m.em_atraso > 0
    ? fmtPct(safeDiv(m.concluidas, m.concluidas + m.em_atraso) * 100) : '—'
  const kpiExecObj   = m.total > 0 ? fmtPct(m.exec_obj) : '—'
  const kpiCgObj     = m.total > 0
    ? fmtPct(safeDiv(m.concluidas + m.em_atraso, m.total) * 100) : '—'

  // ── Previous snapshot KPI (for trend arrows) ──────────────────
  const prevKpi = useMemo(() => {
    if (snapshots.length === 0) return null
    const today = new Date().toISOString().slice(0, 10)
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].snap_date.slice(0, 10) < today) {
        const snap = snapshots[i]
        const pid = snapshotProgramId
        return (pid !== undefined && pid in snap.by_n0) ? snap.by_n0[pid] : snap.kpi
      }
    }
    return null
  }, [snapshots, snapshotProgramId])

  // ── Trend indicators ─────────────────────────────────────────
  const fmtN   = (n: number) => String(Math.round(n))
  const fmtPct1 = (n: number) => `${n.toFixed(1)}%`
  const trendTotal    = mkTrend(m.total,     prevKpi?.total,     fmtN)
  const trendConc     = mkTrend(m.concluidas, prevKpi?.concluidas, fmtN)
  const trendEmDia    = mkTrend(m.em_dia,    prevKpi?.em_dia,    fmtN)
  const trendEmAtraso = mkTrend(m.em_atraso, prevKpi?.em_atraso, fmtN, true)
  const trendGrauExec = mkTrend(m.grau_exec, prevKpi?.exec_media, fmtPct1)
  const trendConcGeral = mkTrend(
    m.total > 0 ? safeDiv(m.concluidas, m.total) * 100 : 0,
    prevKpi && prevKpi.total > 0 ? safeDiv(prevKpi.concluidas, prevKpi.total) * 100 : null,
    fmtPct1,
  )
  const trendConcData = mkTrend(
    m.concluidas + m.em_atraso > 0 ? safeDiv(m.concluidas, m.concluidas + m.em_atraso) * 100 : 0,
    prevKpi && prevKpi.concluidas + prevKpi.em_atraso > 0
      ? safeDiv(prevKpi.concluidas, prevKpi.concluidas + prevKpi.em_atraso) * 100
      : null,
    fmtPct1,
  )

  // ── Bar chart data ───────────────────────────────────────────
  const barData = useMemo(() => {
    const groups = groupBy(leaves, a => a.n1 || '(sem eixo)')
    return Array.from(groups.entries()).map(([n1, acts]) => {
      let concluidas = 0, em_dia = 0, em_atraso = 0
      for (const a of acts) {
        const cls = classify(a)
        if (cls === 'concluida') concluidas++
        else if (cls === 'em_dia') em_dia++
        else em_atraso++
      }
      return { n1, concluidas, em_dia, em_atraso }
    })
  }, [leaves])

  // ── Pie chart data ───────────────────────────────────────────
  const pieData = useMemo(() => [
    { name: 'Concluídas', value: m.concluidas, color: CLR_CONCLUIDAS },
    { name: 'Em dia',     value: m.em_dia,     color: CLR_EM_DIA },
    { name: 'Em atraso',  value: m.em_atraso,  color: CLR_EM_ATRASO },
  ], [m])

  // ── Line chart data ──────────────────────────────────────────
  const lineData = useMemo(() => snapshots.map(s => {
    const pid = snapshotProgramId
    const kpi = (pid !== undefined && pid in s.by_n0) ? s.by_n0[pid] : s.kpi
    const { total, concluidas, em_atraso } = kpi
    const due  = concluidas + em_atraso
    const d    = new Date(s.snap_date)
    const date = d.getFullYear() === new Date().getFullYear()
      ? d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
      : d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
    return {
      date,
      grau_exec_real:  total > 0 ? +kpi.exec_media.toFixed(1) : null,
      grau_exec_obj:   total > 0 ? +(due / total * 100).toFixed(1)    : null,
      conc_geral_real: total > 0 ? +(concluidas / total * 100).toFixed(1) : null,
      conc_geral_obj:  total > 0 ? +(due / total * 100).toFixed(1)    : null,
      conc_data_real:  due   > 0 ? +(concluidas / due   * 100).toFixed(1) : null,
      conc_data_obj:   100,
    }
  }), [snapshots, snapshotProgramId])

  // ── Detail table rows ────────────────────────────────────────
  const tableRows = useMemo((): Record<string, unknown>[] => {
    if (chip === 'eixo') {
      const groups = groupBy(leaves, a => a.n1 || '(sem eixo)')
      return Array.from(groups.entries()).map(([n1, acts]) => ({
        ...buildRow(n1, calcMetrics(acts), false),
        _n1: n1,
      }))
    }
    // Eixo + Plano: parent row per eixo, child rows per plano
    const byEixo = groupBy(leaves, a => a.n1 || '(sem eixo)')
    const rows: Record<string, unknown>[] = []
    for (const [eixo, eixoActs] of byEixo) {
      rows.push({ ...buildRow(eixo, calcMetrics(eixoActs), true), _n1: eixo })
      const byPlano = groupBy(eixoActs, a => a.n2 || '(sem plano)')
      for (const [plano, planoActs] of byPlano) {
        rows.push({ ...buildRow(`↳ ${plano}`, calcMetrics(planoActs), false), _n1: eixo, _n2: plano })
      }
    }
    return rows
  }, [chip, leaves])

  // ── Last snapshot date for Evolution card ────────────────────
  const lastSnapDate = useMemo(() => {
    if (snapshots.length === 0) return null
    const d = new Date(snapshots[snapshots.length - 1].snap_date)
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }, [snapshots])

  // ── Totals row ───────────────────────────────────────────────
  const totalsRow = useMemo((): Record<string, unknown> => ({
    _isTotals: true,
    nome:      'TOTAL',
    total:      m.total,
    concluidas: m.concluidas,
    em_dia:     m.em_dia,
    em_atraso:  m.em_atraso,
    grau_exec:  m.total > 0 ? fmtPct(m.grau_exec) : '—',
    exec_obj:   m.total > 0 ? fmtPct(m.exec_obj)  : '—',
    conc_geral: m.total > 0 ? fmtPct(safeDiv(m.concluidas, m.total) * 100) : '—',
    cg_obj:     m.total > 0 ? fmtPct(safeDiv(m.concluidas + m.em_atraso, m.total) * 100) : '—',
    conc_data:  m.concluidas + m.em_atraso > 0
      ? fmtPct(safeDiv(m.concluidas, m.concluidas + m.em_atraso) * 100) : '—',
    cd_obj:     '100%',
  }), [m])

  // ── Row click → navigate to Actividades with n1/n2 filter ───
  function handleRowClick(row: Record<string, unknown>) {
    if (row._isTotals) return
    const n1 = row._n1 as string | undefined
    const n2 = row._n2 as string | undefined
    setFilter('n1Values', n1 ? [n1] : [])
    // setFilter('n1Values') cascades n2Values=[] — then set n2 if present
    if (n2) setFilter('n2Values', [n2])
    navigate('/actividades')
  }

  return (
    <>
      {/* Subtle fetch indicator */}
      {loading && <div className="dash-loading-bar" />}

      {/* ── Row 1: KPI cards ──────────────────────────────────── */}
      <div className="dashboard-top-grid">

        <Card
          title="Dados Gerais"
          actions={programLabel
            ? <span className="dash-prog-label">{programLabel}</span>
            : undefined}
        >
          <div className="kpi-2col">
            <KpiCard label="Total actividades" value={m.total}     trend={trendTotal} />
            <KpiCard label="Concluídas"  value={m.concluidas} color="green" trend={trendConc} />
            <KpiCard label="Em dia"      value={m.em_dia}     color="blue"  trend={trendEmDia} />
            <KpiCard label="Em atraso"   value={m.em_atraso}  color="red"   trend={trendEmAtraso} />
          </div>
        </Card>

        <Card title="Indicadores de Concretização">
          <div className="ind-section">
            <div className="ind-section-header">
              <span className="ind-dot" style={{ background: 'var(--navy)' }} />
              Realizado
            </div>
            <div className="kpi-3col">
              <KpiCard label="Grau execução" value={kpiGrauExec}  color="navy" trend={trendGrauExec} />
              <KpiCard label="Conc. geral"   value={kpiConcGeral} color="navy" trend={trendConcGeral} />
              <KpiCard label="Conc. à data"  value={kpiConcData}  color="navy" trend={trendConcData} />
            </div>
          </div>
          <div className="ind-section">
            <div className="ind-section-header">
              <span className="ind-dot" style={{ background: 'var(--green)' }} />
              Objectivo
            </div>
            <div className="kpi-3col ind-dashed">
              <KpiCard label="Exec. obj."       value={kpiExecObj} color="green" />
              <KpiCard label="Conc. geral obj." value={kpiCgObj}   color="green" />
              <KpiCard label="Conc. data obj."  value="100%"       color="green" />
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 2: Charts ─────────────────────────────────────── */}
      <div className="dashboard-charts-grid">

        <Card title="Actividades por Eixo — Estado">
          {barData.length === 0 ? (
            <div className="page-placeholder" style={{ minHeight: 220 }}>
              <p>Sem dados carregados</p>
            </div>
          ) : (
            <div className="dash-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 4, right: 8, left: -16, bottom: 48 }}
                >
                  <XAxis
                    dataKey="n1"
                    tick={{ fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="concluidas" name="Concluídas" stackId="a" fill={CLR_CONCLUIDAS}>
                    <LabelList dataKey="concluidas" position="inside"
                      style={{ fontSize: 10, fill: 'white', fontWeight: 600 }}
                      formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                  </Bar>
                  <Bar dataKey="em_dia" name="Em dia" stackId="a" fill={CLR_EM_DIA}>
                    <LabelList dataKey="em_dia" position="inside"
                      style={{ fontSize: 10, fill: 'white', fontWeight: 600 }}
                      formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                  </Bar>
                  <Bar dataKey="em_atraso" name="Em atraso" stackId="a" fill={CLR_EM_ATRASO} radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="em_atraso" position="inside"
                      style={{ fontSize: 10, fill: 'white', fontWeight: 600 }}
                      formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Estado Global">
          {m.total === 0 ? (
            <div className="page-placeholder" style={{ minHeight: 220 }}>
              <p>Sem dados carregados</p>
            </div>
          ) : (
            <div className="dash-chart-container" style={{ position: 'relative' }}>
              {/* Center label overlay — avoids SVG clipping issues */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -62%)',
                textAlign: 'center', pointerEvents: 'none', zIndex: 1,
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>
                  {m.total}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                  actividades
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="42%"
                    outerRadius="68%"
                    label={renderPieLabel as (props: unknown) => React.ReactElement | null}
                    labelLine={false}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => {
                      const v = Number(value)
                      const pct = m.total > 0 ? ((v / m.total) * 100).toFixed(1) : '0'
                      return [`${v} (${pct}%)`]
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 3: Evolution chart ───────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <Card
          title="Evolução"
          actions={lastSnapDate
            ? <span className="dash-prog-label">Último registo: {lastSnapDate}</span>
            : undefined}
        >
          <div className="toggle-chips">
            <button
              className={`chip${evoMetric === 'grau_exec' ? ' active' : ''}`}
              onClick={() => setEvoMetric('grau_exec')}
            >
              Grau de execução
            </button>
            <button
              className={`chip${evoMetric === 'conc_geral' ? ' active' : ''}`}
              onClick={() => setEvoMetric('conc_geral')}
            >
              Concretização geral
            </button>
            <button
              className={`chip${evoMetric === 'conc_data' ? ' active' : ''}`}
              onClick={() => setEvoMetric('conc_data')}
            >
              Concretização à data
            </button>
          </div>
          {lineData.length === 0 ? (
            <div className="page-placeholder" style={{ minHeight: 220 }}>
              <p>Sem dados históricos — os snapshots são guardados automaticamente todos os dias às 23:59</p>
            </div>
          ) : (
            <div className="dash-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lineData}
                  margin={{ top: 4, right: 20, left: -16, bottom: 4 }}
                >
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    dataKey={`${evoMetric}_real`}
                    name="Real"
                    stroke={CLR_EM_DIA}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    dataKey={`${evoMetric}_obj`}
                    name="Objectivo"
                    stroke={CLR_CONCLUIDAS}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 4: Detail table ───────────────────────────────── */}
      <Card title="Detalhe por Eixo e Plano de Acção">
        <div className="toggle-chips">
          <button
            className={`chip${chip === 'eixo' ? ' active' : ''}`}
            onClick={() => setChip('eixo')}
          >
            Eixo
          </button>
          <button
            className={`chip${chip === 'eixo-plano' ? ' active' : ''}`}
            onClick={() => setChip('eixo-plano')}
          >
            Eixo + Plano
          </button>
        </div>
        <Table columns={DETAIL_COLS} rows={tableRows} emptyMessage="Sem dados carregados" layout="fixed" footerRow={totalsRow} onRowClick={handleRowClick} />
      </Card>
    </>
  )
}
