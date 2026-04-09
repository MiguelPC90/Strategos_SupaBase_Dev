import './Dashboard.css'
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
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

// ── Chart colours ─────────────────────────────────────────────
const CLR_CONCLUIDAS = '#95BB42'
const CLR_EM_DIA     = '#002E5E'
const CLR_EM_ATRASO  = '#E24B4A'

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
  if (a.pct >= 100) return 'concluida'
  if (a.status === 'Em dia') return 'em_dia'
  return 'em_atraso'
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
    sumPrev += a.pct_prev
  }
  return {
    total, concluidas, em_dia, em_atraso,
    grau_exec: sumPct  / total,
    exec_obj:  sumPrev / total,
  }
}

function fmtPct(n: number): string { return `${n.toFixed(1)}%` }
function safeDiv(a: number, b: number): number { return b > 0 ? a / b : 0 }

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
    render: (_v, row) => (
      <span style={{ fontWeight: Boolean(row._isParent) ? 700 : 400 }}>
        {String(row.nome ?? '')}
      </span>
    ),
  },
  { key: 'total',      label: 'Total',         sortable: true },
  { key: 'concluidas', label: 'Concluídas',    sortable: true },
  { key: 'em_dia',     label: 'Em dia',        sortable: true },
  { key: 'em_atraso',  label: 'Em atraso',     sortable: true },
  { key: 'grau_exec',  label: 'Grau Execução', sortable: true },
  { key: 'exec_obj',   label: 'Exec. obj.',    sortable: true },
  { key: 'conc_geral', label: 'Conc. Geral',   sortable: true },
  { key: 'cg_obj',     label: 'C.G.Obj.',      sortable: true },
  { key: 'conc_data',  label: 'Conc. Data',    sortable: true },
  { key: 'cd_obj',     label: 'C.D.Obj.',      sortable: true },
]

// ── Component ─────────────────────────────────────────────────
export default function Dashboard() {
  const [chip, setChip]           = useState<'eixo' | 'eixo-plano'>('eixo')
  const [evoMetric, setEvoMetric] = useState<EvoMetric>('grau_exec')

  const { filters, getFilteredActivities } = useFilters()
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
    const date = new Date(s.snap_date + 'T00:00:00')
      .toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
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
      return Array.from(groups.entries()).map(([n1, acts]) =>
        buildRow(n1, calcMetrics(acts), false),
      )
    }
    // Eixo + Plano: parent row per eixo, child rows per plano
    const byEixo = groupBy(leaves, a => a.n1 || '(sem eixo)')
    const rows: Record<string, unknown>[] = []
    for (const [eixo, eixoActs] of byEixo) {
      rows.push(buildRow(eixo, calcMetrics(eixoActs), true))
      const byPlano = groupBy(eixoActs, a => a.n2 || '(sem plano)')
      for (const [plano, planoActs] of byPlano) {
        rows.push(buildRow(`↳ ${plano}`, calcMetrics(planoActs), false))
      }
    }
    return rows
  }, [chip, leaves])

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
            <KpiCard label="Total actividades" value={m.total} />
            <KpiCard label="Concluídas"  value={m.concluidas} color="green" />
            <KpiCard label="Em dia"      value={m.em_dia}     color="blue" />
            <KpiCard label="Em atraso"   value={m.em_atraso}  color="red" />
          </div>
        </Card>

        <Card title="Indicadores de Concretização">
          <div className="ind-section">
            <div className="ind-section-header">
              <span className="ind-dot" style={{ background: 'var(--navy)' }} />
              Realizado
            </div>
            <div className="kpi-3col">
              <KpiCard label="Grau execução" value={kpiGrauExec}  color="navy" />
              <KpiCard label="Conc. geral"   value={kpiConcGeral} color="navy" />
              <KpiCard label="Conc. à data"  value={kpiConcData}  color="navy" />
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
                  <Bar dataKey="concluidas" name="Concluídas" stackId="a" fill={CLR_CONCLUIDAS} />
                  <Bar dataKey="em_dia"     name="Em dia"     stackId="a" fill={CLR_EM_DIA} />
                  <Bar
                    dataKey="em_atraso"
                    name="Em atraso"
                    stackId="a"
                    fill={CLR_EM_ATRASO}
                    radius={[3, 3, 0, 0]}
                  />
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
            <div className="dash-chart-container">
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
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 3: Evolution chart ───────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <Card title="Evolução">
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
        <Table columns={DETAIL_COLS} rows={tableRows} emptyMessage="Sem dados carregados" />
      </Card>
    </>
  )
}
