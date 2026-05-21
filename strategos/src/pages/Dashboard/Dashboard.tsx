import './Dashboard.css'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, AlertTriangle, ChevronRight } from 'lucide-react'
import Spinner from '../../components/Spinner/Spinner'
import SmartKpi from '../../components/Kpi/SmartKpi'
import ContagemKpi from '../../components/Kpi/ContagemKpi'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList,
  LineChart, Line,
  usePlotArea, useXAxisTicks,
} from 'recharts'
import Card from '../../components/Card/Card'
import Table, { type Column } from '../../components/Table/Table'
import EmptyState from '../../components/EmptyState/EmptyState'
import { useActivities } from '../../hooks/useActivities'
import { usePrograms } from '../../hooks/usePrograms'
import { useEixos } from '../../hooks/useEixos'
import { usePlanos } from '../../hooks/usePlanos'
import { useSnapshots } from '../../hooks/useSnapshots'
import { useFilters } from '../../context/FilterContext'
import { useProgramLabels, type ProgramLabels } from '../../hooks/useProgramLabels'
import { usePermissions } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import { generateAlerts } from '../../lib/alerts'
import type { Alert, AlertRule } from '../../lib/alerts'
import type { Activity, Program, Eixo, Plano } from '../../types/index'
import { leafPctPrev, leafStatus, computeRowState, rollupDateRange, type RowState, type ThresholdBand } from '../../lib/rollup'
import { buildThresholdsMap, type PlanoThresholds } from '../../hooks/useThresholdsMap'
import { colors, statusColor } from '../../lib/tokens'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Chart colours ─────────────────────────────────────────────
const CLR_CONCLUIDAS = statusColor('done')
const CLR_EM_DIA     = statusColor('ontrack')
const CLR_EM_RISCO   = statusColor('risk')
const CLR_EM_ATRASO  = statusColor('late')

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
  em_risco: number
  em_atraso: number
  /** Average pct (0–100) */
  grau_exec: number
  /** Average pct_prev (0–100) */
  exec_obj: number
}

function classify(
  a: Activity,
  tLeaves?: ThresholdBand,
): 'concluida' | 'em_dia' | 'em_risco' | 'em_atraso' {
  const s = leafStatus(a, TODAY, tLeaves)
  if (s === 'Concluída') return 'concluida'
  if (s === 'Em risco')  return 'em_risco'
  if (s === 'Em atraso') return 'em_atraso'
  return 'em_dia'
}

function calcMetrics(
  acts: Activity[],
  thresholdsMap?: Map<string, PlanoThresholds>,
): Metrics {
  const total = acts.length
  if (total === 0) {
    return { total: 0, concluidas: 0, em_dia: 0, em_risco: 0, em_atraso: 0, grau_exec: 0, exec_obj: 0 }
  }
  let concluidas = 0, em_dia = 0, em_risco = 0, em_atraso = 0, sumPct = 0, sumPrev = 0
  for (const a of acts) {
    const tLeaves = thresholdsMap?.get(a.plano_id ?? '')?.leaves
    const cls = classify(a, tLeaves)
    if (cls === 'concluida') concluidas++
    else if (cls === 'em_dia') em_dia++
    else if (cls === 'em_risco') em_risco++
    else em_atraso++
    sumPct  += a.pct
    sumPrev += leafPctPrev(a, TODAY)
  }
  return {
    total, concluidas, em_dia, em_risco, em_atraso,
    grau_exec: sumPct  / total,
    exec_obj:  sumPrev / total,
  }
}

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

// ── AlertsZone ─────────────────────────────────────────────────
function AlertsZone({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="alert-zone">
      {alerts.length === 0 ? (
        <div className="alert-zone-empty">Sem pontos de atenção abertos</div>
      ) : (
        <div className="alerts-list">
          {alerts.map(a => (
            <div key={a.id} className={`alert-card severity-${a.severity}`}>
              <div className="alert-card-icon"><AlertTriangle size={14} strokeWidth={1.5} /></div>
              <div className="alert-card-body">
                <div className="alert-card-title">{a.title}</div>
                <div className="alert-card-desc">{a.description}</div>
              </div>
              {a.href && <a href={a.href} className="alert-card-link"><ChevronRight size={14} strokeWidth={1.5} /></a>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Bar chart types & helpers ──────────────────────────────────
interface BarEntry {
  name: string
  concluidas: number
  em_dia: number
  em_risco: number
  em_atraso: number
  isFirstOfProg?: boolean
  program?: string
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

function barCounts(
  acts: Activity[],
  thresholdsMap?: Map<string, PlanoThresholds>,
): { concluidas: number; em_dia: number; em_risco: number; em_atraso: number } {
  let concluidas = 0, em_dia = 0, em_risco = 0, em_atraso = 0
  for (const a of acts) {
    const tLeaves = thresholdsMap?.get(a.plano_id ?? '')?.leaves
    const cls = classify(a, tLeaves)
    if (cls === 'concluida') concluidas++
    else if (cls === 'em_dia') em_dia++
    else if (cls === 'em_risco') em_risco++
    else em_atraso++
  }
  return { concluidas, em_dia, em_risco, em_atraso }
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
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.fill }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

// ── DeviationBar ───────────────────────────────────────────────
const STATE_FILL: Record<RowState, string> = {
  'Concluída': 'var(--status-done)',
  'Em dia':    'var(--stratgos-moss)',
  'Em risco':  'var(--status-risk)',
  'Em atraso': 'var(--status-late)',
}

interface DeviationBarProps {
  actual: number
  target: number
}

function DeviationBar({ actual, target }: DeviationBarProps) {
  const state         = computeRowState(actual, target)
  const fillColor     = STATE_FILL[state]
  const displayActual = Math.min(100, Math.max(0, actual))
  const displayTarget = Math.min(100, Math.max(0, target))
  return (
    <div
      className="dev-bar-cell"
      role="meter"
      aria-valuenow={actual}
      aria-valuemin={0}
      aria-valuemax={Math.max(100, target)}
      aria-label={`${actual.toFixed(1)}% de ${target.toFixed(1)}% (${state})`}
    >
      <div className="dev-bar-track">
        <div
          className="dev-bar-fill"
          style={{ width: `${displayActual}%`, background: fillColor }}
        />
        <div
          className="dev-bar-target-marker"
          style={{ left: `${displayTarget}%` }}
        />
      </div>
      <div className="dev-bar-values">
        <span style={{ color: fillColor, fontWeight: 600 }}>
          {actual.toFixed(1)}%
        </span>
        <span className="dev-val-sep"> / </span>
        <span className="dev-val-target">{target.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function buildRow(nome: string, m: Metrics, isParent: boolean): Record<string, unknown> {
  const concGeral = safeDiv(m.concluidas, m.total) * 100
  const concData  = safeDiv(m.concluidas, m.concluidas + m.em_atraso) * 100
  const cgObj     = safeDiv(m.concluidas + m.em_atraso, m.total) * 100
  const grauExec  = m.total > 0 ? m.grau_exec : null
  const execObj   = m.total > 0 ? m.exec_obj  : null
  return {
    _isParent: isParent,
    nome,
    _estado: grauExec !== null && execObj !== null ? computeRowState(grauExec, execObj) : null,
    total:      m.total,
    concluidas: m.concluidas,
    em_dia:     m.em_dia,
    em_risco:   m.em_risco,
    em_atraso:  m.em_atraso,
    grau_exec:  grauExec,
    exec_obj:   execObj,
    conc_geral: m.total > 0 ? concGeral   : null,
    cg_obj:     m.total > 0 ? cgObj       : null,
    conc_data:  m.concluidas + m.em_atraso > 0 ? concData : null,
    cd_obj:     100,
  }
}

// ── Row level helpers ─────────────────────────────────────────
function getLevel(row: Record<string, unknown>): 0 | 1 | 2 {
  if (row._n2) return 2
  if (row._n1 && !row._isProgHeader) return 1
  return 0
}

type N1Group = { row: Record<string, unknown>; children: Record<string, unknown>[] }
type N0Group = { row: Record<string, unknown>; children: N1Group[] }

function sortHierarchically(
  rows: Record<string, unknown>[],
  key: string,
  dir: 'asc' | 'desc',
): Record<string, unknown>[] {
  function cmp(a: Record<string, unknown>, b: Record<string, unknown>): number {
    const av = a[key]
    const bv = b[key]
    if (av == null && bv == null) return 0
    if (av == null) return dir === 'asc' ? -1 : 1
    if (bv == null) return dir === 'asc' ? 1 : -1
    const num = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, { numeric: true })
    return dir === 'asc' ? num : -num
  }

  const groups: N0Group[] = []
  for (const row of rows) {
    const level = getLevel(row)
    if (level === 0) {
      groups.push({ row, children: [] })
    } else if (level === 1) {
      const parent = groups[groups.length - 1]
      if (parent) parent.children.push({ row, children: [] })
    } else {
      const parent = groups[groups.length - 1]
      if (parent) {
        const n1 = parent.children[parent.children.length - 1]
        if (n1) n1.children.push(row)
      }
    }
  }

  groups.sort((a, b) => cmp(a.row, b.row))
  for (const g of groups) {
    g.children.sort((a, b) => cmp(a.row, b.row))
    for (const n1g of g.children) {
      n1g.children.sort(cmp)
    }
  }

  const result: Record<string, unknown>[] = []
  for (const g of groups) {
    result.push(g.row)
    for (const n1g of g.children) {
      result.push(n1g.row)
      result.push(...n1g.children)
    }
  }
  return result
}

const ESTADO_CLASS: Record<string, string> = {
  'Concluída': 'done',
  'Em dia':    'ontrack',
  'Em risco':  'risk',
  'Em atraso': 'late',
}

// ── Table columns ─────────────────────────────────────────────
const DETAIL_COLS: Column[] = [
  {
    key: 'nome',
    label: 'Designação',
    sortable: true,
    minWidth: '220px',
    render: (_v, row) => {
      const level    = getLevel(row)
      const isTotals = Boolean(row._isTotals)
      const paddingLeft = level === 1 ? '20px' : level === 2 ? '36px' : undefined
      const fontWeight  = (level === 0 || isTotals) ? 700 : level === 1 ? 600 : 400
      const color       = isTotals || level === 0
        ? 'var(--stratgos-ink-900)'
        : level === 1
          ? 'var(--stratgos-ink-700)'
          : 'var(--stratgos-ink-500)'
      return (
        <span style={{ fontWeight, fontSize: level === 0 ? 13.5 : 13, color, paddingLeft }}>
          {String(row.nome ?? '')}
        </span>
      )
    },
  },
  {
    key: '_estado',
    label: 'Estado',
    sortable: true,
    width: '108px',
    render: (_v, row) => {
      const state = row._estado as string | null
      if (!state) return <span style={{ color: 'var(--text3)' }}>—</span>
      const cls = ESTADO_CLASS[state] ?? ''
      return <span className={`status-pill ${cls}`}>{state}</span>
    },
  },
  { key: 'total',      label: 'Total',         sortable: true, width: '70px'  },
  { key: 'concluidas', label: 'Concluídas',    sortable: true, width: '90px'  },
  { key: 'em_dia',     label: 'Em dia',        sortable: true, width: '70px'  },
  { key: 'em_risco',   label: 'Em risco',      sortable: true, width: '76px'  },
  { key: 'em_atraso',  label: 'Em atraso',     sortable: true, width: '80px'  },
  {
    key: 'grau_exec',
    label: 'Grau de Execução',
    sortable: true,
    minWidth: '140px',
    align: 'left',
    render: (_v, row) => {
      const actual = row.grau_exec as number | null
      const target = row.exec_obj as number | null
      if (actual === null || target === null) return <span style={{ color: 'var(--text3)' }}>—</span>
      return <DeviationBar actual={actual} target={target} />
    },
  },
  {
    key: 'conc_geral',
    label: 'Concretização Geral',
    sortable: true,
    minWidth: '140px',
    align: 'left',
    render: (_v, row) => {
      const actual = row.conc_geral as number | null
      const target = row.cg_obj as number | null
      if (actual === null || target === null) return <span style={{ color: 'var(--text3)' }}>—</span>
      return <DeviationBar actual={actual} target={target} />
    },
  },
  {
    key: 'conc_data',
    label: 'Concretização à Data',
    sortable: true,
    minWidth: '140px',
    align: 'left',
    render: (_v, row) => {
      const actual = row.conc_data as number | null
      if (actual === null) return <span style={{ color: 'var(--text3)' }}>—</span>
      return <DeviationBar actual={actual} target={100} />
    },
  },
]

// ── ProgramSeparators ─────────────────────────────────────────
// Renders dashed vertical lines between program groups.
// Must live inside a BarChart (Recharts 3.x context provides usePlotArea / useXAxisTicks).
function ProgramSeparators({ data }: { data: BarEntry[] }) {
  const plotArea = usePlotArea()
  const ticks    = useXAxisTicks()

  if (!plotArea || !ticks || data.length < 2) return null

  const nameToX = new Map<string, number>()
  for (const tick of ticks) {
    nameToX.set(String(tick.value), tick.coordinate)
  }

  const topY    = plotArea.y
  const bottomY = plotArea.y + plotArea.height
  const lines: React.ReactElement[] = []

  for (let i = 1; i < data.length; i++) {
    if (!data[i].isFirstOfProg) continue
    const prevX = nameToX.get(data[i - 1].name)
    const currX = nameToX.get(data[i].name)
    if (prevX === undefined || currX === undefined) continue
    const sepX = (prevX + currX) / 2
    lines.push(
      <line key={`sep-${i}`}
        x1={sepX} y1={topY} x2={sepX} y2={bottomY}
        stroke="var(--stratgos-ink-300)" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.8}
      />
    )
  }

  return <g>{lines}</g>
}

// ── BarChartCard ───────────────────────────────────────────────
interface BarChartCardProps {
  leaves: Activity[]
  programs: Program[]
  allEixos: Eixo[]
  thresholdsMap: Map<string, PlanoThresholds>
  labels: ProgramLabels
}

function BarChartCard({ leaves, programs, allEixos, thresholdsMap, labels }: BarChartCardProps) {
  const [chartChip, setChartChip] = useState<'eixo' | 'programa'>('eixo')
  const chartDataRef  = useRef<BarEntry[]>([])
  const xCoordsRef    = useRef<Record<number, number>>({})

  const chartDataEixo = useMemo((): BarEntry[] => {
    if (programs.length === 0) {
      return Array.from(groupBy(leaves, a => a.n1 || '(sem eixo)').entries())
        .map(([n1, acts]) => ({ name: n1, ...barCounts(acts, thresholdsMap) }))
    }
    const sortedProgs = programs.slice().sort((a, b) => a.sort_order - b.sort_order)
    const progsWithData = sortedProgs.filter(p => leaves.some(a => a.program_id === p.id))
    const multiProg = progsWithData.length > 1
    const result: BarEntry[] = []
    let lastProgId: string | null = null
    for (const prog of sortedProgs) {
      const progLeaves = leaves.filter(a => a.program_id === prog.id)
      if (progLeaves.length === 0) continue
      const progName = multiProg ? prog.name : undefined
      const progEixos = allEixos
        .filter(e => e.program_id === prog.id)
        .sort((a, b) => a.sort_order - b.sort_order)
      const byEixo = groupBy(progLeaves, a => a.n1 || '(sem eixo)')
      const pushEntry = (name: string, acts: Activity[]) => {
        const isFirstOfProg = prog.id !== lastProgId
        if (isFirstOfProg) lastProgId = prog.id
        result.push({ name, ...barCounts(acts, thresholdsMap), program: progName, isFirstOfProg })
      }
      if (progEixos.length > 0) {
        const seen = new Set<string>()
        for (const e of progEixos) {
          const acts = byEixo.get(e.name)
          if (!acts) continue
          seen.add(e.name)
          pushEntry(e.name, acts)
        }
        for (const [n1, acts] of byEixo) {
          if (!seen.has(n1)) pushEntry(n1, acts)
        }
      } else {
        for (const [n1, acts] of byEixo) {
          pushEntry(n1, acts)
        }
      }
    }
    return result
  }, [leaves, programs, allEixos, thresholdsMap])

  const chartDataProg = useMemo((): BarEntry[] =>
    programs
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(prog => {
        const progLeaves = leaves.filter(a => a.program_id === prog.id)
        if (progLeaves.length === 0) return null
        return { name: prog.name, ...barCounts(progLeaves, thresholdsMap) }
      })
      .filter((e): e is BarEntry => e !== null),
  [leaves, programs, thresholdsMap])

  chartDataRef.current = chartDataEixo
  xCoordsRef.current   = {}

  const EixoAxisTick = useCallback((props: AxisTickProps): React.ReactElement | null => {
    const { x, y, index } = props
    if (x === undefined || y === undefined || index === undefined) return null
    const data = chartDataRef.current
    const entry = data[index]
    if (!entry) return null

    xCoordsRef.current[index] = x

    const groups: Array<{ progName: string; start: number; end: number }> = []
    for (let i = 0; i < data.length; i++) {
      const pn = data[i].program ?? ''
      if (groups.length === 0 || groups[groups.length - 1].progName !== pn) {
        groups.push({ progName: pn, start: i, end: i })
      } else {
        groups[groups.length - 1].end = i
      }
    }
    const group = groups.find(g => index >= g.start && index <= g.end)

    const showProgLabel = index === group?.end && !!group?.progName
    let progLabelX = 0
    if (showProgLabel && group) {
      const xs: number[] = []
      for (let i = group.start; i <= group.end; i++) {
        const xi = xCoordsRef.current[i]
        if (xi !== undefined) xs.push(xi)
      }
      if (xs.length > 0) progLabelX = xs.reduce((s, v) => s + v, 0) / xs.length - x
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={14} textAnchor="middle" fontSize={11} fill={colors.brand.ink500}>
          {truncate(entry.name, 14)}
        </text>
        {showProgLabel && (
          <text x={progLabelX} y={30} textAnchor="middle" fontSize={11} fontWeight={600} fill={colors.brand.ink700}>
            {group!.progName}
          </text>
        )}
      </g>
    )
  }, [])

  const ProgAxisTick = useCallback((props: AxisTickProps): React.ReactElement | null => {
    const { x, y, payload } = props
    if (x === undefined || y === undefined || !payload) return null
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={14} textAnchor="middle" fontSize={12} fontWeight={600} fill={colors.brand.ink700}>
          {truncate(payload.value, 20)}
        </text>
      </g>
    )
  }, [])


  return (
    <Card
      title={chartChip === 'eixo' ? `Actividades por ${labels.n1} — Estado` : `Actividades por ${labels.n0} — Estado`}
      actions={
        <div className="dash-chart-toggle">
          <button className={`chip${chartChip === 'eixo' ? ' active' : ''}`} onClick={() => setChartChip('eixo')}>{labels.n1}</button>
          <button className={`chip${chartChip === 'programa' ? ' active' : ''}`} onClick={() => setChartChip('programa')}>{labels.n0}</button>
        </div>
      }
    >
      {chartChip === 'eixo' ? (
        chartDataEixo.length === 0 ? (
          <div className="page-placeholder" style={{ minHeight: 220 }}><p>Sem dados carregados</p></div>
        ) : (
          <div className="dash-chart-container">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartDataEixo} margin={{ top: 4, right: 8, left: -16, bottom: 52 }} barCategoryGap="12%">
                <XAxis dataKey="name" tick={EixoAxisTick as (props: unknown) => React.ReactElement | null} interval={0} tickLine={false} height={48} axisLine={{ stroke: 'var(--stratgos-ink-100)' }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={ChartTooltip as (props: unknown) => React.ReactElement | null} />
                <Legend wrapperStyle={{ paddingTop: 24, fontSize: 11 }} />
                <ProgramSeparators data={chartDataEixo} />
                <Bar dataKey="em_dia" name="Em dia" stackId="a" fill={CLR_EM_DIA} maxBarSize={80}>
                  <LabelList dataKey="em_dia" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
                <Bar dataKey="em_risco" name="Em risco" stackId="a" fill={CLR_EM_RISCO} maxBarSize={80}>
                  <LabelList dataKey="em_risco" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
                <Bar dataKey="em_atraso" name="Em atraso" stackId="a" fill={CLR_EM_ATRASO} maxBarSize={80}>
                  <LabelList dataKey="em_atraso" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
                <Bar dataKey="concluidas" name="Concluídas" stackId="a" fill={CLR_CONCLUIDAS} radius={[3, 3, 0, 0]} maxBarSize={80}>
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
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartDataProg} margin={{ top: 4, right: 8, left: -16, bottom: 52 }} barCategoryGap="30%">
                <XAxis dataKey="name" tick={ProgAxisTick as (props: unknown) => React.ReactElement | null} interval={0} tickLine={false} height={48} axisLine={{ stroke: 'var(--stratgos-ink-100)' }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={ChartTooltip as (props: unknown) => React.ReactElement | null} />
                <Legend wrapperStyle={{ paddingTop: 24, fontSize: 11 }} />
                <Bar dataKey="em_dia" name="Em dia" stackId="a" fill={CLR_EM_DIA} maxBarSize={80}>
                  <LabelList dataKey="em_dia" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
                <Bar dataKey="em_risco" name="Em risco" stackId="a" fill={CLR_EM_RISCO} maxBarSize={80}>
                  <LabelList dataKey="em_risco" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
                <Bar dataKey="em_atraso" name="Em atraso" stackId="a" fill={CLR_EM_ATRASO} maxBarSize={80}>
                  <LabelList dataKey="em_atraso" position="inside" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }} formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')} />
                </Bar>
                <Bar dataKey="concluidas" name="Concluídas" stackId="a" fill={CLR_CONCLUIDAS} radius={[3, 3, 0, 0]} maxBarSize={80}>
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
  thresholdsMap: Map<string, PlanoThresholds>
  labels: ProgramLabels
}

function DetailTableCard({ leaves, programs, allEixos, allPlanos, totalsRow, onRowClick, thresholdsMap, labels }: DetailTableCardProps) {
  const [tableChip, setTableChip] = useState<'programa' | 'eixo' | 'plano'>('eixo')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSortChange(key: string, dir: 'asc' | 'desc') {
    setSortKey(key)
    setSortDir(dir)
  }

  const tableRows = useMemo((): Record<string, unknown>[] => {
    const sortedProgs = programs.slice().sort((a, b) => a.sort_order - b.sort_order)

    if (tableChip === 'programa') {
      return sortedProgs
        .map(prog => {
          const progLeaves = leaves.filter(a => a.program_id === prog.id)
          if (progLeaves.length === 0) return null
          return { ...buildRow(prog.name, calcMetrics(progLeaves, thresholdsMap), false), _prog_id: prog.id }
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
        rows.push({ ...buildRow(prog.name, calcMetrics(progLeaves, thresholdsMap), false), _prog_id: prog.id, _isProgHeader: true })
        for (const { name, leaves: eixoLeaves } of orderedEixoEntries(progLeaves, prog.id)) {
          rows.push({ ...buildRow(name, calcMetrics(eixoLeaves, thresholdsMap), false), _n1: name, _prog_id: prog.id })
        }
      }
      return rows
    }

    // ── Plano de Acção ────────────────────────────────────────
    for (const prog of sortedProgs) {
      const progLeaves = leaves.filter(a => a.program_id === prog.id)
      if (progLeaves.length === 0) continue
      rows.push({ ...buildRow(prog.name, calcMetrics(progLeaves, thresholdsMap), false), _prog_id: prog.id, _isProgHeader: true })
      for (const { name: eixoName, leaves: eixoLeaves } of orderedEixoEntries(progLeaves, prog.id)) {
        rows.push({ ...buildRow(eixoName, calcMetrics(eixoLeaves, thresholdsMap), true), _n1: eixoName, _prog_id: prog.id, _indent: 1 })
        const byPlano = groupBy(eixoLeaves, a => a.n2 || '(sem plano)')
        const eixoPlanos = allPlanos
          .filter(p => p.program_id === prog.id && p.eixo?.name === eixoName)
          .sort((a, b) => a.sort_order - b.sort_order)
        const seen = new Set<string>()
        for (const plano of eixoPlanos) {
          const acts = byPlano.get(plano.name)
          if (!acts) continue
          seen.add(plano.name)
          rows.push({ ...buildRow(plano.name, calcMetrics(acts, thresholdsMap), false), _n1: eixoName, _n2: plano.name, _indent: 2 })
        }
        for (const [n2, acts] of byPlano) {
          if (seen.has(n2)) continue
          rows.push({ ...buildRow(n2, calcMetrics(acts, thresholdsMap), false), _n1: eixoName, _n2: n2, _indent: 2 })
        }
      }
    }
    return rows
  }, [tableChip, leaves, programs, allEixos, allPlanos, thresholdsMap])

  const sortedTableRows = useMemo(
    () => sortKey ? sortHierarchically(tableRows, sortKey, sortDir) : tableRows,
    [tableRows, sortKey, sortDir],
  )

  const title = tableChip === 'programa' ? `Detalhe por ${labels.n0}`
    : tableChip === 'eixo' ? `Detalhe por ${labels.n1}`
    : `Detalhe por ${labels.n2}`

  return (
    <Card title={title}>
      <div className="toggle-chips">
        <button
          className={`chip${tableChip === 'programa' ? ' active' : ''}`}
          onClick={() => setTableChip('programa')}
        >
          {labels.n0}
        </button>
        <button
          className={`chip${tableChip === 'eixo' ? ' active' : ''}`}
          onClick={() => setTableChip('eixo')}
        >
          {labels.n1}
        </button>
        <button
          className={`chip${tableChip === 'plano' ? ' active' : ''}`}
          onClick={() => setTableChip('plano')}
        >
          {labels.n2}
        </button>
      </div>
      <div className="detail-table">
        <Table
          columns={DETAIL_COLS}
          rows={sortedTableRows}
          emptyMessage="Sem dados carregados"
          layout="fixed"
          footerRow={totalsRow}
          onRowClick={onRowClick}
          onSortChange={handleSortChange}
          externalSortKey={sortKey}
          externalSortDir={sortDir}
          rowClassName={row => {
            const level = getLevel(row)
            if (level === 0) return 'detail-row-0'
            if (level === 1) return 'detail-row-1'
            if (level === 2) return 'detail-row-2'
            return undefined
          }}
        />
      </div>
    </Card>
  )
}

// ── Dashboard (main) ───────────────────────────────────────────
export default function Dashboard() {
  const [evoMetric, setEvoMetric] = useState<EvoMetric>('grau_exec')

  const navigate = useNavigate()
  const { filters, setFilter, getFilteredActivities } = useFilters()
  const labels = useProgramLabels(filters.programIds.length === 1 ? filters.programIds[0] : null)
  const { hasAccess }                      = usePermissions()
  const { activities, loading }            = useActivities({ cutoffDate: filters.cutoffDate })
  const { programs }                       = usePrograms()
  const { eixos: allEixos }                = useEixos()
  const { planos: allPlanos }              = usePlanos()
  const snapshotProgramId                  = filters.programIds[0]
  const { snapshots }                      = useSnapshots(snapshotProgramId)

  const thresholdsMap = useMemo(
    () => buildThresholdsMap(programs, allPlanos),
    [programs, allPlanos],
  )

  // Apply global filters then restrict to leaf level (level 4)
  const filtered = useMemo(
    () => getFilteredActivities(activities),
    [activities, getFilteredActivities],
  )
  const leaves = useMemo(() => filtered.filter(a => a.level === 4), [filtered])

  const accessiblePlanIds = useMemo(
    () => new Set(allPlanos.filter(p => hasAccess('dashboard', p.program_id ?? undefined, p.id)).map(p => p.id)),
    [allPlanos, hasAccess],
  )
  const accessibleLeaves = useMemo(
    () => leaves.filter(a => !a.plano_id || accessiblePlanIds.has(a.plano_id)),
    [leaves, accessiblePlanIds],
  )
  const visiblePlanos = useMemo(
    () => allPlanos.filter(p => accessiblePlanIds.has(p.id)),
    [allPlanos, accessiblePlanIds],
  )

  const m = useMemo(() => calcMetrics(accessibleLeaves, thresholdsMap), [accessibleLeaves, thresholdsMap])

  // ── Snapshot references ──────────────────────────────────────
  const currentSnapshot = useMemo(
    () => snapshots.length > 0 ? snapshots[snapshots.length - 1] : null,
    [snapshots],
  )

  const { kpi7dAgo, delta7dLabel } = useMemo(() => {
    if (snapshots.length === 0) return { kpi7dAgo: null, delta7dLabel: null }
    const oldest = new Date(snapshots[0].snap_date)
    const today = new Date()
    const daysAvailable = Math.floor((today.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))
    if (daysAvailable < 3) return { kpi7dAgo: null, delta7dLabel: null }
    const N = Math.min(daysAvailable, 7)
    const label = N >= 7 ? 'últimos 7 dias' : `últimos ${N} dias`
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - N)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].snap_date.slice(0, 10) <= cutoffStr) {
        const snap = snapshots[i]
        const pid = snapshotProgramId
        return {
          kpi7dAgo: (pid !== undefined && pid in snap.by_n0) ? snap.by_n0[pid] : snap.kpi,
          delta7dLabel: label,
        }
      }
    }
    return { kpi7dAgo: null, delta7dLabel: null }
  }, [snapshots, snapshotProgramId])

  const snap14dAgo = useMemo(() => {
    if (snapshots.length === 0) return null
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].snap_date.slice(0, 10) <= cutoffStr) return snapshots[i]
    }
    return null
  }, [snapshots])

  // ── Alert rules ──────────────────────────────────────────────
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  useEffect(() => {
    supabase.from('alert_rules').select('*').then(({ data }) => {
      if (data) setAlertRules(data as AlertRule[])
    })
  }, [])

  const leavesByPlano = useMemo(() => {
    const m = new Map<string, typeof accessibleLeaves>()
    for (const a of accessibleLeaves) {
      if (!a.plano_id) continue
      const arr = m.get(a.plano_id) ?? []
      arr.push(a)
      m.set(a.plano_id, arr)
    }
    return m
  }, [leaves])

  const planoRefs = useMemo(
    () => allPlanos.map(p => ({
      id: p.id,
      name: p.name,
      program_id: p.program_id,
      start_date: rollupDateRange(leavesByPlano.get(p.id) ?? []).bs,
    })),
    [allPlanos, leavesByPlano],
  )

  // Breadcrumb filter: null = no breadcrumb active.
  const breadcrumbFilter = useMemo((): Set<string> | null => {
    const { programIds, n1Values, n2Values } = filters
    if (n2Values.length > 0) {
      return new Set(allPlanos.filter(p => n2Values.includes(p.name)).map(p => p.id))
    }
    if (n1Values.length > 0) {
      return new Set(allPlanos.filter(p => p.eixo && n1Values.includes(p.eixo.name)).map(p => p.id))
    }
    if (programIds.length > 0) {
      return new Set(allPlanos.filter(p => p.program_id && programIds.includes(p.program_id)).map(p => p.id))
    }
    return null
  }, [filters, allPlanos])

  // Final alert filter = intersection of breadcrumb and plan-level permissions.
  const alertPlanoFilter = useMemo((): Set<string> | null => {
    if (!breadcrumbFilter) return accessiblePlanIds
    const intersection = new Set<string>()
    for (const id of breadcrumbFilter) {
      if (accessiblePlanIds.has(id)) intersection.add(id)
    }
    return intersection
  }, [breadcrumbFilter, accessiblePlanIds])

  const [alerts, setAlerts] = useState<Alert[]>([])
  useEffect(() => {
    let cancelled = false
    generateAlerts({
      rules: alertRules,
      currentSnapshot,
      snapshot14daysAgo: snap14dAgo,
      planos: planoRefs,
      planoFilter: alertPlanoFilter,
    }).then(result => { if (!cancelled) setAlerts(result) })
    return () => { cancelled = true }
  }, [alertRules, currentSnapshot, snap14dAgo, planoRefs, alertPlanoFilter])

  // ── Zone 1 — Smart KPI values & deltas ──────────────────────
  const grauExecVal    = m.total > 0 ? m.grau_exec : null
  const grauExecTarget = m.total > 0 ? m.exec_obj : null
  const grauExecDelta  = (grauExecVal !== null && kpi7dAgo && kpi7dAgo.total > 0)
    ? grauExecVal - kpi7dAgo.exec_media : null

  const concGeralVal    = m.total > 0 ? safeDiv(m.concluidas, m.total) * 100 : null
  const concGeralTarget = m.total > 0 ? safeDiv(m.concluidas + m.em_atraso, m.total) * 100 : null
  const concGeralDelta  = (concGeralVal !== null && kpi7dAgo && kpi7dAgo.total > 0)
    ? concGeralVal - safeDiv(kpi7dAgo.concluidas, kpi7dAgo.total) * 100 : null

  const concDataVal   = m.concluidas + m.em_atraso > 0
    ? safeDiv(m.concluidas, m.concluidas + m.em_atraso) * 100 : null
  const concDataDelta = (concDataVal !== null && kpi7dAgo &&
    kpi7dAgo.concluidas + kpi7dAgo.em_atraso > 0)
    ? concDataVal - safeDiv(kpi7dAgo.concluidas, kpi7dAgo.concluidas + kpi7dAgo.em_atraso) * 100
    : null

  // ── Zone 2 — Contagem KPI deltas ────────────────────────────
  const delta7Conc     = kpi7dAgo !== null ? m.concluidas - kpi7dAgo.concluidas : null
  const delta7EmDia    = kpi7dAgo !== null ? m.em_dia - kpi7dAgo.em_dia : null
  const delta7EmRisco  = kpi7dAgo !== null ? m.em_risco - (kpi7dAgo.em_risco ?? 0) : null
  const delta7EmAtraso = kpi7dAgo !== null ? m.em_atraso - kpi7dAgo.em_atraso : null

  // ── Pie chart data ───────────────────────────────────────────
  const pieData = useMemo(() => [
    { name: 'Em dia',     value: m.em_dia,     color: CLR_EM_DIA },
    { name: 'Em risco',   value: m.em_risco,   color: CLR_EM_RISCO },
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
    const execObj  = total > 0 ? +((kpi.exec_media_prev ?? kpi.exec_media).toFixed(1)) : null
    return {
      date,
      grau_exec_real:  execReal,
      grau_exec_obj:   execObj,
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
  const totalsRow = useMemo((): Record<string, unknown> => {
    const grauExec = m.total > 0 ? m.grau_exec : null
    const execObj  = m.total > 0 ? m.exec_obj  : null
    return {
      _isTotals: true,
      nome:      'TOTAL',
      _estado:   grauExec !== null && execObj !== null ? computeRowState(grauExec, execObj) : null,
      total:      m.total,
      concluidas: m.concluidas,
      em_dia:     m.em_dia,
      em_risco:   m.em_risco,
      em_atraso:  m.em_atraso,
      grau_exec:  grauExec,
      exec_obj:   execObj,
      conc_geral: m.total > 0 ? safeDiv(m.concluidas, m.total) * 100 : null,
      cg_obj:     m.total > 0 ? safeDiv(m.concluidas + m.em_atraso, m.total) * 100 : null,
      conc_data:  m.concluidas + m.em_atraso > 0
        ? safeDiv(m.concluidas, m.concluidas + m.em_atraso) * 100 : null,
      cd_obj:     100,
    }
  }, [m])

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

  if (!loading && activities.length === 0) {
    return (
      <EmptyState
        icon="data"
        title="Sem dados carregados"
        description="Selecciona um programa nos filtros para visualizar os indicadores."
        size="lg"
      />
    )
  }

  return (
    <>
      {/* ── Executive Brief ───────────────────────────────────── */}
      <div className="executive-brief">
        <div className="executive-brief-grid">
          <div className="executive-brief-column">
            <div className="executive-brief-header">
              <h2 className="executive-brief-title">Resumo Executivo · Visão Semanal</h2>
            </div>
            <div className="executive-brief-card kpis-card">
              <div className="executive-kpi-grid">
                <SmartKpi label="Grau de Execução"    tooltipTerm="grau-execucao"       value={grauExecVal}  delta={grauExecDelta}  target={grauExecTarget} />
                <SmartKpi label="Concretização Geral" tooltipTerm="concretizacao-geral" value={concGeralVal} delta={concGeralDelta} target={concGeralTarget} />
                <SmartKpi label="Conc. à Data"        tooltipTerm="concretizacao-data"  value={concDataVal}  delta={concDataDelta}  target={100} />
              </div>
              <div className="contagem-kpi-grid">
                <ContagemKpi value={m.concluidas} total={m.total} label="concluídas" tooltipTerm="estado-concluida"  delta={delta7Conc}     deltaVariant="good"    deltaLabel={delta7dLabel} />
                <ContagemKpi value={m.em_dia}     total={m.total} label="em dia"     tooltipTerm="estado-em-dia"     delta={delta7EmDia}    deltaVariant="neutral" deltaLabel={delta7dLabel} />
                <ContagemKpi value={m.em_risco}   total={m.total} label="em risco"   tooltipTerm="estado-em-risco"   delta={delta7EmRisco}  deltaVariant="bad"     deltaLabel={delta7dLabel} />
                <ContagemKpi value={m.em_atraso}  total={m.total} label="em atraso"  tooltipTerm="estado-em-atraso"  delta={delta7EmAtraso} variant="late" deltaVariant="bad" deltaLabel={delta7dLabel} />
              </div>
            </div>
          </div>

          <div className="executive-brief-column">
            <div className="executive-brief-header">
              <h2 className="executive-brief-title">
                Pontos de Atenção{alerts.length > 0 && ` · ${alerts.length}`}
              </h2>
            </div>
            <div className="executive-brief-card alertas-card">
              <AlertsZone alerts={alerts} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Charts ─────────────────────────────────────── */}
      <div className="dashboard-charts-grid">

        <BarChartCard leaves={accessibleLeaves} programs={programs} allEixos={allEixos} thresholdsMap={thresholdsMap} labels={labels} />

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
              <ResponsiveContainer width="100%" height={280}>
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
              <ResponsiveContainer width="100%" height={360}>
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
        leaves={accessibleLeaves}
        programs={programs}
        allEixos={allEixos}
        allPlanos={visiblePlanos}
        totalsRow={totalsRow}
        onRowClick={handleRowClick}
        thresholdsMap={thresholdsMap}
        labels={labels}
      />
    </>
  )
}
