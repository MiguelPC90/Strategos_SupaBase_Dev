import './Dashboard.css'
import { useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Spinner from '../../components/Spinner/Spinner'
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
import { useEixos } from '../../hooks/useEixos'
import { usePlanos } from '../../hooks/usePlanos'
import { useSnapshots } from '../../hooks/useSnapshots'
import { useFilters } from '../../context/FilterContext'
import type { Activity, Program, Eixo, Plano } from '../../types/index'
import { leafPctPrev, leafStatus } from '../../lib/rollup'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Chart colours ─────────────────────────────────────────────
const CLR_CONCLUIDAS = '#95BB42'
const CLR_EM_DIA     = '#002E5E'
const CLR_EM_ATRASO  = '#A32D2D'

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

// ── Bar chart types & helpers ──────────────────────────────────
interface BarEntry {
  name: string
  concluidas: number
  em_dia: number
  em_atraso: number
  isSpacer?: boolean
  program?: string
}

function barCounts(acts: Activity[]): { concluidas: number; em_dia: number; em_atraso: number } {
  let concluidas = 0, em_dia = 0, em_atraso = 0
  for (const a of acts) {
    const cls = classify(a)
    if (cls === 'concluida') concluidas++
    else if (cls === 'em_dia') em_dia++
    else em_atraso++
  }
  return { concluidas, em_dia, em_atraso }
}

interface AxisTickProps {
  x?: number
  y?: number
  payload?: { value: string }
  index?: number
  [key: string]: unknown
}

interface ChartTooltipItem {
  name: string
  value: number
  fill: string
  payload: BarEntry
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: ChartTooltipItem[]; label?: string }) {
  if (!active || !payload?.length || payload[0]?.payload?.isSpacer) return null
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.fill }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
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
    render: (_v, row) => {
      const isN0     = Boolean(row._isProgHeader) || (!!row._prog_id && !row._n1 && !row._isTotals)
      const isN1     = !!row._n1 && !row._n2 && !row._isProgHeader
      const isN2     = !!row._n2
      const isTotals = Boolean(row._isTotals)
      const paddingLeft = isN1 ? '16px' : isN2 ? '28px' : undefined
      return (
        <span style={{
          fontWeight:  (isN0 || isN1 || isTotals) ? 700 : 400,
          fontSize:    isN0 ? 13.5 : 13,
          color:       (isN0 || isTotals) ? 'var(--navy)' : 'var(--text)',
          paddingLeft,
        }}>
          {String(row.nome ?? '')}
        </span>
      )
    },
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

// ── BarChartCard ───────────────────────────────────────────────
interface BarChartCardProps {
  leaves: Activity[]
  programs: Program[]
  allEixos: Eixo[]
}

function BarChartCard({ leaves, programs, allEixos }: BarChartCardProps) {
  const [chartChip, setChartChip] = useState<'eixo' | 'programa'>('eixo')
  const chartDataRef  = useRef<BarEntry[]>([])
  const xCoordsRef    = useRef<Record<number, number>>({})

  const chartDataEixo = useMemo((): BarEntry[] => {
    if (programs.length === 0) {
      return Array.from(groupBy(leaves, a => a.n1 || '(sem eixo)').entries())
        .map(([n1, acts]) => ({ name: n1, ...barCounts(acts) }))
    }
    const sortedProgs = programs.slice().sort((a, b) => a.sort_order - b.sort_order)
    const progsWithData = sortedProgs.filter(p => leaves.some(a => a.program_id === p.id))
    // Tag each eixo entry with its program name when there are multiple programs,
    // so EixoAxisTick can render a centered group label below the eixo names.
    const multiProg = progsWithData.length > 1
    const result: BarEntry[] = []
    for (const prog of sortedProgs) {
      const progLeaves = leaves.filter(a => a.program_id === prog.id)
      if (progLeaves.length === 0) continue
      // Insert a narrow spacer bar between program groups to create a visual separator
      if (result.length > 0 && multiProg) {
        result.push({ name: '', concluidas: 0, em_dia: 0, em_atraso: 0, isSpacer: true })
      }
      const progName = multiProg ? prog.name : undefined
      const progEixos = allEixos
        .filter(e => e.program_id === prog.id)
        .sort((a, b) => a.sort_order - b.sort_order)
      const byEixo = groupBy(progLeaves, a => a.n1 || '(sem eixo)')
      if (progEixos.length > 0) {
        const seen = new Set<string>()
        for (const e of progEixos) {
          const acts = byEixo.get(e.name)
          if (!acts) continue
          seen.add(e.name)
          result.push({ name: e.name, ...barCounts(acts), program: progName })
        }
        for (const [n1, acts] of byEixo) {
          if (!seen.has(n1)) result.push({ name: n1, ...barCounts(acts), program: progName })
        }
      } else {
        for (const [n1, acts] of byEixo) {
          result.push({ name: n1, ...barCounts(acts), program: progName })
        }
      }
    }
    return result
  }, [leaves, programs, allEixos])

  const chartDataProg = useMemo((): BarEntry[] =>
    programs
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(prog => {
        const progLeaves = leaves.filter(a => a.program_id === prog.id)
        if (progLeaves.length === 0) return null
        return { name: prog.name, ...barCounts(progLeaves) }
      })
      .filter((e): e is BarEntry => e !== null),
  [leaves, programs])

  chartDataRef.current = chartDataEixo
  xCoordsRef.current   = {}

  const EixoAxisTick = useCallback((props: AxisTickProps): React.ReactElement | null => {
    const { x, y, index } = props
    if (x === undefined || y === undefined || index === undefined) return null
    const data = chartDataRef.current
    const entry = data[index]
    // Return nothing for spacer bars — they are invisible separators
    if (!entry || entry.isSpacer) return null

    // Accumulate each bar's pixel x so we can compute a true group center later
    xCoordsRef.current[index] = x

    // Build consecutive program groups, skipping spacer entries
    const groups: Array<{ progName: string; start: number; end: number }> = []
    for (let i = 0; i < data.length; i++) {
      if (data[i].isSpacer) continue
      const pn = data[i].program ?? ''
      if (groups.length === 0 || groups[groups.length - 1].progName !== pn) {
        groups.push({ progName: pn, start: i, end: i })
      } else {
        groups[groups.length - 1].end = i
      }
    }
    const group = groups.find(g => index >= g.start && index <= g.end)

    // Render the program label on the LAST bar of the group so all earlier
    // x positions are already stored in xCoordsRef and we can compute the
    // true pixel centre of the group.
    const showProgLabel = index === group?.end && !!group?.progName
    let progLabelX = 0
    if (showProgLabel && group) {
      const xs: number[] = []
      for (let i = group.start; i <= group.end; i++) {
        const xi = xCoordsRef.current[i]
        if (xi !== undefined) xs.push(xi)
      }
      if (xs.length > 0) {
        const avgX = xs.reduce((s, v) => s + v, 0) / xs.length
        progLabelX = avgX - x
      }
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={10} transform="rotate(-35)" textAnchor="end" fontSize={11} fill="#5c5c58">
          {entry.name}
        </text>
        {showProgLabel && (
          <text x={progLabelX} y={30} textAnchor="middle" fontSize={11} fontWeight={600} fill="#002E5E">
            {group!.progName}
          </text>
        )}
      </g>
    )
  }, [])

  return (
    <Card
      title={chartChip === 'eixo' ? 'Actividades por Eixo — Estado' : 'Actividades por Programa — Estado'}
      actions={
        <div className="dash-chart-toggle">
          <button className={`chip${chartChip === 'eixo' ? ' active' : ''}`} onClick={() => setChartChip('eixo')}>Eixo</button>
          <button className={`chip${chartChip === 'programa' ? ' active' : ''}`} onClick={() => setChartChip('programa')}>Programa</button>
        </div>
      }
    >
      {chartChip === 'eixo' ? (
        chartDataEixo.length === 0 ? (
          <div className="page-placeholder" style={{ minHeight: 220 }}><p>Sem dados carregados</p></div>
        ) : (
          <div className="dash-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataEixo} margin={{ top: 4, right: 8, left: -16, bottom: 56 }}>
                <XAxis dataKey="name" tick={EixoAxisTick as (props: unknown) => React.ReactElement | null} interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={ChartTooltip as (props: unknown) => React.ReactElement | null} />
                <Legend wrapperStyle={{ paddingTop: 24, fontSize: 11 }} />
                <Bar dataKey="em_dia" name="Em dia" stackId="a" fill={CLR_EM_DIA}>
                  <LabelList dataKey="em_dia" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
                <Bar dataKey="em_atraso" name="Em atraso" stackId="a" fill={CLR_EM_ATRASO}>
                  <LabelList dataKey="em_atraso" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
                <Bar dataKey="concluidas" name="Concluídas" stackId="a" fill={CLR_CONCLUIDAS} radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="concluidas" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      ) : (
        chartDataProg.length === 0 ? (
          <div className="page-placeholder" style={{ minHeight: 220 }}><p>Sem dados carregados</p></div>
        ) : (
          <div className="dash-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataProg} margin={{ top: 4, right: 8, left: -16, bottom: 48 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={ChartTooltip as (props: unknown) => React.ReactElement | null} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="em_dia" name="Em dia" stackId="a" fill={CLR_EM_DIA}>
                  <LabelList dataKey="em_dia" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
                <Bar dataKey="em_atraso" name="Em atraso" stackId="a" fill={CLR_EM_ATRASO}>
                  <LabelList dataKey="em_atraso" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
                <Bar dataKey="concluidas" name="Concluídas" stackId="a" fill={CLR_CONCLUIDAS} radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="concluidas" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      )}
    </Card>
  )
}

// ── DetailTableCard ────────────────────────────────────────────
interface DetailTableCardProps {
  leaves: Activity[]
  programs: Program[]
  allEixos: Eixo[]
  allPlanos: Plano[]
  totalsRow: Record<string, unknown>
  onRowClick: (row: Record<string, unknown>) => void
}

function DetailTableCard({ leaves, programs, allEixos, allPlanos, totalsRow, onRowClick }: DetailTableCardProps) {
  const [tableChip, setTableChip] = useState<'programa' | 'eixo' | 'plano'>('eixo')

  const tableRows = useMemo((): Record<string, unknown>[] => {
    const sortedProgs = programs.slice().sort((a, b) => a.sort_order - b.sort_order)

    if (tableChip === 'programa') {
      return sortedProgs
        .map(prog => {
          const progLeaves = leaves.filter(a => a.program_id === prog.id)
          if (progLeaves.length === 0) return null
          return { ...buildRow(prog.name, calcMetrics(progLeaves), false), _prog_id: prog.id }
        })
        .filter((r): r is Record<string, unknown> => r !== null)
    }

    const rows: Record<string, unknown>[] = []

    function orderedEixoEntries(progLeaves: Activity[], progId: string): Array<{ name: string; leaves: Activity[] }> {
      const byEixo = groupBy(progLeaves, a => a.n1 || '(sem eixo)')
      const progEixos = allEixos
        .filter(e => e.program_id === progId)
        .sort((a, b) => a.sort_order - b.sort_order)
      const result: Array<{ name: string; leaves: Activity[] }> = []
      const seen = new Set<string>()
      for (const e of progEixos) {
        const acts = byEixo.get(e.name)
        if (!acts) continue
        seen.add(e.name)
        result.push({ name: e.name, leaves: acts })
      }
      for (const [n1, acts] of byEixo) {
        if (seen.has(n1)) continue
        result.push({ name: n1, leaves: acts })
      }
      return result
    }

    if (tableChip === 'eixo') {
      for (const prog of sortedProgs) {
        const progLeaves = leaves.filter(a => a.program_id === prog.id)
        if (progLeaves.length === 0) continue
        rows.push({ ...buildRow(prog.name, calcMetrics(progLeaves), false), _prog_id: prog.id, _isProgHeader: true })
        for (const { name, leaves: eixoLeaves } of orderedEixoEntries(progLeaves, prog.id)) {
          rows.push({ ...buildRow(name, calcMetrics(eixoLeaves), false), _n1: name, _prog_id: prog.id })
        }
      }
      return rows
    }

    // ── Plano de Acção ────────────────────────────────────────
    for (const prog of sortedProgs) {
      const progLeaves = leaves.filter(a => a.program_id === prog.id)
      if (progLeaves.length === 0) continue
      rows.push({ ...buildRow(prog.name, calcMetrics(progLeaves), false), _prog_id: prog.id, _isProgHeader: true })
      for (const { name: eixoName, leaves: eixoLeaves } of orderedEixoEntries(progLeaves, prog.id)) {
        rows.push({ ...buildRow(eixoName, calcMetrics(eixoLeaves), true), _n1: eixoName, _prog_id: prog.id, _indent: 1 })
        const byPlano = groupBy(eixoLeaves, a => a.n2 || '(sem plano)')
        const eixoPlanos = allPlanos
          .filter(p => p.program_id === prog.id && p.eixo?.name === eixoName)
          .sort((a, b) => a.sort_order - b.sort_order)
        const seen = new Set<string>()
        for (const plano of eixoPlanos) {
          const acts = byPlano.get(plano.name)
          if (!acts) continue
          seen.add(plano.name)
          rows.push({ ...buildRow(plano.name, calcMetrics(acts), false), _n1: eixoName, _n2: plano.name, _indent: 2 })
        }
        for (const [n2, acts] of byPlano) {
          if (seen.has(n2)) continue
          rows.push({ ...buildRow(n2, calcMetrics(acts), false), _n1: eixoName, _n2: n2, _indent: 2 })
        }
      }
    }
    return rows
  }, [tableChip, leaves, programs, allEixos, allPlanos])

  const title = tableChip === 'programa' ? 'Detalhe por Programa'
    : tableChip === 'eixo' ? 'Detalhe por Eixo'
    : 'Detalhe por Plano de Acção'

  return (
    <Card title={title}>
      <div className="toggle-chips">
        <button
          className={`chip${tableChip === 'programa' ? ' active' : ''}`}
          onClick={() => setTableChip('programa')}
        >
          Programa
        </button>
        <button
          className={`chip${tableChip === 'eixo' ? ' active' : ''}`}
          onClick={() => setTableChip('eixo')}
        >
          Eixo
        </button>
        <button
          className={`chip${tableChip === 'plano' ? ' active' : ''}`}
          onClick={() => setTableChip('plano')}
        >
          Plano de Acção
        </button>
      </div>
      <Table
        columns={DETAIL_COLS}
        rows={tableRows}
        emptyMessage="Sem dados carregados"
        layout="fixed"
        footerRow={totalsRow}
        onRowClick={onRowClick}
        rowClassName={row => {
          if (row._prog_id && !row._n1 && !row._isTotals) return 'dash-prog-hdr'
          if (row._n1 && !row._n2) return 'dash-n1-row'
          return undefined
        }}
      />
    </Card>
  )
}

// ── Dashboard (main) ───────────────────────────────────────────
export default function Dashboard() {
  const [evoMetric, setEvoMetric] = useState<EvoMetric>('grau_exec')

  const navigate = useNavigate()
  const { filters, setFilter, getFilteredActivities } = useFilters()
  const { activities, loading }            = useActivities({ cutoffDate: filters.cutoffDate })
  const { programs }                       = usePrograms()
  const { eixos: allEixos }                = useEixos()
  const { planos: allPlanos }              = usePlanos()
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

  // ── Pie chart data ───────────────────────────────────────────
  const pieData = useMemo(() => [
    { name: 'Em dia',     value: m.em_dia,     color: CLR_EM_DIA },
    { name: 'Em atraso',  value: m.em_atraso,  color: CLR_EM_ATRASO },
    { name: 'Concluídas', value: m.concluidas, color: CLR_CONCLUIDAS },
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
    const execReal = total > 0 ? +kpi.exec_media.toFixed(1) : null
    return {
      date,
      grau_exec_real:  execReal,
      grau_exec_obj:   execReal,                        // no pct_previsto in snapshot; use same as exec
      conc_geral_real: total > 0 ? +(concluidas / total * 100).toFixed(1) : null,
      conc_geral_obj:  total > 0 ? +(due / total * 100).toFixed(1) : null, // expected: (concluded + overdue) / total
      conc_data_real:  due > 0 ? +(concluidas / due * 100).toFixed(1) : null,
      conc_data_obj:   100,
    }
  }), [snapshots, snapshotProgramId])

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

  // ── Row click → navigate to Actividades with appropriate filter ─
  function handleRowClick(row: Record<string, unknown>) {
    if (row._isTotals) return
    const progId = row._prog_id as string | undefined
    const n1     = row._n1 as string | undefined
    const n2     = row._n2 as string | undefined
    if (row._isProgHeader || (!n1 && progId)) {
      // Program header rows and Programa-view rows
      if (progId) setFilter('programIds', [progId])
    } else {
      setFilter('n1Values', n1 ? [n1] : [])
      if (n2) setFilter('n2Values', [n2])
    }
    navigate('/actividades')
  }

  if (loading && activities.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <Spinner />
      </div>
    )
  }

  return (
    <>
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

        <BarChartCard leaves={leaves} programs={programs} allEixos={allEixos} />

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
      <DetailTableCard
        leaves={leaves}
        programs={programs}
        allEixos={allEixos}
        allPlanos={allPlanos}
        totalsRow={totalsRow}
        onRowClick={handleRowClick}
      />
    </>
  )
}
