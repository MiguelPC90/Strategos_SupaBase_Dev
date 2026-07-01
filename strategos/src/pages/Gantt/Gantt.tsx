import './Gantt.css'
import { memo, useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect, type ReactNode, type Dispatch, type SetStateAction } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight, X, CheckCircle2, CircleDot, AlertCircle, XCircle } from 'lucide-react'
import Spinner from '../../components/Spinner/Spinner'
import Card from '../../components/Card/Card'
import EmptyState from '../../components/EmptyState/EmptyState'
import { useActivities } from '../../hooks/useActivities'
import { applyStatusCutoff } from '../../lib/activityUtils'
import { usePrograms } from '../../hooks/usePrograms'
import { useFilters } from '../../context/FilterContext'
import { useProgramLabels } from '../../hooks/useProgramLabels'
import { leafPctPrev, rollupPctPrev, computeGroupStatusFromEff, type RowState } from '../../lib/rollup'
import { useEffectiveValues, type EffectiveValue } from '../../hooks/useEffectiveValues'
import { useBandResolver } from '../../hooks/useThresholdsMap'
import type { Activity, Program } from '../../types/index'
import type { DependencyType } from '../../types/index'
import { useActivityDependencies } from '../../hooks/useActivityDependencies'
import { usePlanos } from '../../hooks/usePlanos'
import { useEixos } from '../../hooks/useEixos'
import { usePermissions } from '../../hooks/usePermissions'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Types ──────────────────────────────────────────────────────
type Scale     = 'Semana' | 'Mês' | 'Trimestre'
type LevelView    = 'todos' | 'programa' | 'eixo' | 'plano' | 'macro' | 'actividade'

const COL_WIDTH: Record<Scale, number> = { Semana: 40, Mês: 80, Trimestre: 120 }
const COL_NAME   = 280
const COL_STATUS = 96
const COL_EXEC   = 60
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ── Status helpers ─────────────────────────────────────────────
const STATE_FILL: Record<RowState, string> = {
  'Concluída': 'var(--status-done)', 'Em dia': 'var(--status-ontrack)',
  'Em risco': 'var(--status-risk)', 'Em atraso': 'var(--status-late)',
}

function groupPct(n4leaves: Activity[], eff: Map<string, EffectiveValue>): number {
  if (n4leaves.length === 0) return 0
  return n4leaves.reduce((s, a) => s + (eff.get(a.id)?.pct ?? a.pct), 0) / n4leaves.length
}

const PILL_CLASS: Record<RowState, string> = {
  'Concluída': 'done', 'Em dia': 'ontrack', 'Em risco': 'risk', 'Em atraso': 'late',
}

const StatusPill = memo(function StatusPill({ state }: { state: RowState }) {
  return <span className={`status-pill ${PILL_CLASS[state]}`}>{state}</span>
})

function highlightMatch(text: string, query: string): ReactNode {
  if (!query.trim()) return text
  const q = query.trim().toLowerCase()
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="gi-search-highlight">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

const ALL_FILTER_STATES: { key: RowState; icon: ReactNode; color: string }[] = [
  { key: 'Concluída', icon: <CheckCircle2 size={12} strokeWidth={1.5} />, color: 'var(--status-done)' },
  { key: 'Em dia',    icon: <CircleDot size={12} strokeWidth={1.5} />,    color: 'var(--status-ontrack)' },
  { key: 'Em risco',  icon: <AlertCircle size={12} strokeWidth={1.5} />,  color: 'var(--status-risk)' },
  { key: 'Em atraso', icon: <XCircle size={12} strokeWidth={1.5} />,      color: 'var(--status-late)' },
]

function StatusFilterDropdown({
  statusFilter,
  setStatusFilter,
}: {
  statusFilter: Set<RowState>
  setStatusFilter: (updater: (prev: Set<RowState>) => Set<RowState>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (key: RowState) => {
    setStatusFilter(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const count = statusFilter.size
  const label = count === 4 ? 'Estado: Todos'
              : count === 0 ? 'Estado: Nenhum'
              : `Estado: ${count}`

  return (
    <div className="act-statusfilter" ref={ref}>
      <button type="button" className="act-statusfilter-btn" onClick={() => setOpen(o => !o)}>
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5"
             strokeLinecap="round" strokeLinejoin="round"
             style={{ marginLeft: 8 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="act-statusfilter-popup">
          {ALL_FILTER_STATES.map(s => (
            <label key={s.key} className="act-statusfilter-option">
              <input type="checkbox" checked={statusFilter.has(s.key)}
                     onChange={() => toggle(s.key)} />
              <span className="act-statusfilter-icon" style={{ color: s.color }}>{s.icon}</span>
              <span>{s.key}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tree types ─────────────────────────────────────────────────
interface N3Group { n3: string; acts: Activity[] }
interface N2Group { n2: string; n3groups: N3Group[]; allActs: Activity[] }
interface N1Group { n1: string; n2groups: N2Group[]; allActs: Activity[] }
interface N0Group { progId: string; progName: string; n1groups: N1Group[]; allActs: Activity[] }

// ── Level-view collapse key builder ───────────────────────────
function buildLevelKeys(
  level: LevelView,
  n0tree: N0Group[] | null,
  tree: N1Group[]
): Set<string> {
  const keys = new Set<string>()
  if (level === 'todos' || level === 'actividade') return keys

  if (level === 'programa') {
    if (n0tree) for (const n0g of n0tree) keys.add(`n0:${n0g.progId}`)
    return keys
  }

  const n1groups = n0tree ? n0tree.flatMap(g => g.n1groups) : tree

  if (level === 'eixo') {
    for (const n1g of n1groups) keys.add(`n1:${n1g.n1}`)
  } else if (level === 'plano') {
    for (const n1g of n1groups) {
      for (const n2g of n1g.n2groups) keys.add(`n2:${n1g.n1}:${n2g.n2}`)
    }
  } else if (level === 'macro') {
    for (const n1g of n1groups) {
      for (const n2g of n1g.n2groups) {
        for (const n3g of n2g.n3groups) { if (n3g.n3) keys.add(`n3:${n1g.n1}:${n2g.n2}:${n3g.n3}`) }
      }
    }
  }
  return keys
}

function buildTree(activities: Activity[]): N1Group[] {
  const n1Map = new Map<string, Activity[]>()
  for (const a of activities) {
    const key = a.n1 || '—'
    if (!n1Map.has(key)) n1Map.set(key, [])
    n1Map.get(key)!.push(a)
  }
  return Array.from(n1Map.entries()).map(([n1, allActs]) => {
    const n2Map = new Map<string, Activity[]>()
    for (const a of allActs) {
      const key = a.n2 || '—'
      if (!n2Map.has(key)) n2Map.set(key, [])
      n2Map.get(key)!.push(a)
    }
    const n2groups = Array.from(n2Map.entries()).map(([n2, n2Acts]) => {
      const n3Map = new Map<string, Activity[]>()
      for (const a of n2Acts) {
        const key = a.n3 || ''
        if (!n3Map.has(key)) n3Map.set(key, [])
        n3Map.get(key)!.push(a)
      }
      const n3groups: N3Group[] = Array.from(n3Map.entries())
        .filter(([k]) => k !== '')
        .map(([n3, acts]) => ({ n3, acts }))
      const noN3 = n3Map.get('') ?? []
      if (noN3.length > 0) n3groups.push({ n3: '', acts: noN3 })
      return { n2, n3groups, allActs: n2Acts }
    })
    return { n1, n2groups, allActs }
  })
}

function buildProgramTree(activities: Activity[], programs: Program[]): N0Group[] {
  const progMap = new Map<string, Activity[]>()
  for (const a of activities) {
    const key = a.program_id ?? ''
    if (!progMap.has(key)) progMap.set(key, [])
    progMap.get(key)!.push(a)
  }
  const groups: N0Group[] = []
  for (const p of programs) {
    if (progMap.has(p.id)) {
      const acts = progMap.get(p.id)!
      groups.push({ progId: p.id, progName: p.name, n1groups: buildTree(acts), allActs: acts })
    }
  }
  const unmatched = progMap.get('')
  if (unmatched?.length) {
    groups.push({ progId: '', progName: '—', n1groups: buildTree(unmatched), allActs: unmatched })
  }
  return groups
}

// ── Date / period helpers ──────────────────────────────────────
interface Period { label: string; start: Date }

function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(1)
  r.setMonth(r.getMonth() + n)
  return r
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  return r
}

function buildPeriods(rangeStart: Date, rangeEnd: Date, scale: Scale): Period[] {
  const periods: Period[] = []
  if (scale === 'Mês') {
    let cur = startOfMonth(rangeStart)
    while (cur <= rangeEnd) {
      periods.push({
        label: `${MONTHS_PT[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`,
        start: new Date(cur),
      })
      cur = addMonths(cur, 1)
    }
  } else if (scale === 'Semana') {
    let cur = startOfWeek(rangeStart)
    while (cur <= rangeEnd) {
      const dd = String(cur.getDate()).padStart(2, '0')
      const mm = String(cur.getMonth() + 1).padStart(2, '0')
      periods.push({ label: `${dd}/${mm}`, start: new Date(cur) })
      cur = new Date(cur.getTime() + 7 * 86400000)
    }
  } else {
    let cur = new Date(rangeStart.getFullYear(), Math.floor(rangeStart.getMonth() / 3) * 3, 1)
    while (cur <= rangeEnd) {
      periods.push({
        label: `T${Math.floor(cur.getMonth() / 3) + 1} ${String(cur.getFullYear()).slice(2)}`,
        start: new Date(cur),
      })
      cur = addMonths(cur, 3)
    }
  }
  return periods
}

function computeDateRange(activities: Activity[]): { rangeStart: Date; rangeEnd: Date } | null {
  let minT = Infinity, maxT = -Infinity
  for (const a of activities) {
    for (const d of [a.bs, a.bf, a.rs, a.rf]) {
      if (d) {
        const t = new Date(d).getTime()
        if (t < minT) minT = t
        if (t > maxT) maxT = t
      }
    }
  }
  if (!isFinite(minT)) return null
  return { rangeStart: addMonths(new Date(minT), -1), rangeEnd: addMonths(new Date(maxT), 1) }
}

function groupDateRange(acts: Activity[], eff: Map<string, EffectiveValue>) {
  const n4s = acts.filter(a => a.level === 4)
  let minBs: string | null = null, maxBf: string | null = null
  let minRs: string | null = null, maxRf: string | null = null
  for (const n4 of n4s) {
    const ev = eff.get(n4.id)
    if (!ev) continue
    if (ev.bs && (!minBs || ev.bs < minBs)) minBs = ev.bs
    if (ev.bf && (!maxBf || ev.bf > maxBf)) maxBf = ev.bf
    if (ev.rs && (!minRs || ev.rs < minRs)) minRs = ev.rs
    if (ev.rf && (!maxRf || ev.rf > maxRf)) maxRf = ev.rf
  }
  return { bs: minBs, bf: maxBf, rs: minRs, rf: maxRf }
}

function fmt(d: string | null): string {
  if (!d) return '—'
  const p = d.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

// ── Dependency arrow constants ─────────────────────────────────
const ROW_H    = 34          // matches .gantt-sticky-cell { height: 34px }
const STICKY_W = COL_NAME + COL_STATUS + COL_EXEC  // 436px left fixed columns
const HEADER_H = 29          // approximate thead height (7px padding × 2 + 15px text)

// ── Dependency arrow types ─────────────────────────────────────
interface RowInfo  { id: string; rowIndex: number; bs: string | null; bf: string | null }
interface Arrow    { id: string; fromX: number; fromY: number; toX: number; toY: number; depType: DependencyType }
interface GroupData { status: RowState; bs: string | null; bf: string | null; rs: string | null; rf: string | null; pct: number }
const EMPTY_GROUP_DATA: GroupData = { status: 'Em dia', bs: null, bf: null, rs: null, rf: null, pct: 0 }

// ── ArrowPath ─────────────────────────────────────────────────
function ArrowPath({ arrow }: { arrow: Arrow }) {
  const { fromX, fromY, toX, toY, depType } = arrow
  let d: string
  if (depType === 'FS') {
    const pivot = Math.max(fromX + 12, (fromX + toX) / 2)
    d = `M ${fromX} ${fromY} H ${pivot} V ${toY} H ${toX}`
  } else if (depType === 'SS') {
    const pivot = Math.min(fromX, toX) - 12
    d = `M ${fromX} ${fromY} H ${pivot} V ${toY} H ${toX}`
  } else if (depType === 'FF') {
    const pivot = Math.max(fromX, toX) + 12
    d = `M ${fromX} ${fromY} H ${pivot} V ${toY} H ${toX}`
  } else {
    const pivot = (fromX + toX) / 2
    d = `M ${fromX} ${fromY} H ${pivot} V ${toY} H ${toX}`
  }
  return (
    <path
      d={d}
      stroke="rgba(101,83,68,0.55)"
      strokeWidth="1.5"
      fill="none"
      markerEnd="url(#dep-arrow)"
    />
  )
}

// ── Tooltip data ───────────────────────────────────────────────
interface TooltipState {
  name: string
  bs: string | null; bf: string | null
  rs: string | null; rf: string | null
  pct: number; pct_prev: number
  rowState: RowState
  childCount: number | null
  x: number; y: number
}

// ── Tooltip sub-component ─────────────────────────────────────
function GanttTooltip({ tooltip }: { tooltip: TooltipState }) {
  const { name, bs, bf, rs, rf, pct, pct_prev, rowState, childCount, x, y } = tooltip

  let deviationDays: number | null = null
  if (rf && bf) {
    deviationDays = Math.round((new Date(rf).getTime() - new Date(bf).getTime()) / 86400000)
  } else if (rs && bs) {
    deviationDays = Math.round((new Date(rs).getTime() - new Date(bs).getTime()) / 86400000)
  }

  const deviationText = deviationDays === null
    ? '—'
    : deviationDays > 0 ? `+${deviationDays} dias`
    : deviationDays < 0 ? `${deviationDays} dias`
    : '0 dias'

  const deviationCls = deviationDays === null || deviationDays === 0
    ? 'delay-zero'
    : deviationDays > 0 ? 'delay-pos' : 'delay-neg'

  const execCls = pct > pct_prev ? 'delay-neg'
    : pct < pct_prev ? 'delay-pos'
    : ''

  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x + 12, top: y + 12, opacity: 0 })

  useLayoutEffect(() => {
    if (!tooltipRef.current) return
    const rect = tooltipRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 12
    const offset = 12

    let left = x + offset
    if (left + rect.width + margin > vw) {
      left = x - rect.width - offset
      if (left < margin) left = margin
    }

    let top = y + offset
    if (top + rect.height + margin > vh) {
      top = y - rect.height - offset
      if (top < margin) top = margin
    }

    setPos({ left, top, opacity: 1 })
  }, [x, y])

  return (
    <div
      ref={tooltipRef}
      className="gantt-tooltip"
      style={{ left: pos.left, top: pos.top, opacity: pos.opacity, transition: 'opacity 80ms ease-out' }}
    >
      <div className="gantt-tooltip-name">{name}</div>
      <div className="gantt-tooltip-status">
        <StatusPill state={rowState} />
      </div>
      <div className="gantt-tooltip-grid">
        <span className="gantt-tooltip-label">Baseline</span>
        <span className="gantt-tooltip-value">{fmt(bs)} → {fmt(bf)}</span>
        <span className="gantt-tooltip-label">Real</span>
        <span className="gantt-tooltip-value">{fmt(rs)} → {fmt(rf)}</span>
        <span className="gantt-tooltip-label">Desvio</span>
        <span className={`gantt-tooltip-value ${deviationCls}`}>{deviationText}</span>
        <span className="gantt-tooltip-label">Execução</span>
        <span className={`gantt-tooltip-value${execCls ? ` ${execCls}` : ''}`}>
          {pct}% (prev. {Math.round(pct_prev)}%)
        </span>
        {childCount !== null && (
          <>
            <span className="gantt-tooltip-label">Actividades</span>
            <span className="gantt-tooltip-value">{childCount}</span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Bar sub-component ──────────────────────────────────────────
interface BarProps {
  start: string | null; end: string | null
  rangeStart: Date; totalMs: number
  variant: 'baseline' | 'real'
  lane: 'top' | 'bottom'
  status: RowState
}

const GanttBar = memo(function GanttBar({ start, end, rangeStart, totalMs, variant, lane, status }: BarProps) {
  if (!start || !end || totalMs <= 0) return null
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (s > e) return null
  const leftPct  = ((s - rangeStart.getTime()) / totalMs) * 100
  const widthPct = Math.max((e - s) / totalMs * 100, 0.15)
  let bg: string
  if (variant === 'baseline') {
    bg = 'rgba(0,46,94,0.22)'
  } else {
    bg = STATE_FILL[status]
  }
  return (
    <div
      className={`gantt-bar gantt-bar-${lane}`}
      style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: bg }}
    />
  )
})

// ── GanttFlatRow model ─────────────────────────────────────────
type GanttFlatRow =
  | {
      kind: 'group'
      key: string
      rowClass: string
      nameClass: string
      label: string
      indent: number
      collapseKey: string
      status: RowState
      pct: number
      bs: string | null
      bf: string | null
      rs: string | null   // gd.rs ?? gd.bs (baseline fallback already applied)
      rf: string | null   // gd.rf ?? gd.bf
      n4leaves: Activity[]
    }
  | {
      kind: 'activity'
      key: string
      act: Activity
      rowClass: string
      nameClass: string
      indent: number
      status: RowState
      pct: number
      bs: string | null   // ev?.bs ?? null (null-honest; bars use bs directly)
      bf: string | null   // ev?.bf ?? null
      rs: string | null   // ev?.rs ?? null (bars use rs ?? bs for baseline fallback)
      rf: string | null   // ev?.rf ?? null
    }

// ── Row identity cache ─────────────────────────────────────────
function shallowEqualRow(a: GanttFlatRow, b: GanttFlatRow): boolean {
  if (a.kind !== b.kind || a.key !== b.key) return false
  if (a.rowClass !== b.rowClass || a.nameClass !== b.nameClass) return false
  if (a.indent !== b.indent || a.status !== b.status || a.pct !== b.pct) return false
  if (a.bs !== b.bs || a.bf !== b.bf || a.rs !== b.rs || a.rf !== b.rf) return false
  if (a.kind === 'group' && b.kind === 'group') return a.label === b.label && a.collapseKey === b.collapseKey
  if (a.kind === 'activity' && b.kind === 'activity') return a.act === b.act
  return false
}

// ── GroupRow ───────────────────────────────────────────────────
interface GroupRowProps {
  row: Extract<GanttFlatRow, { kind: 'group' }>
  isCollapsed: boolean
  toggle: (key: string) => void
  searchQuery: string
  rangeStart: Date
  totalMs: number
  timelineW: number
  nPeriodCols: number
  setTooltip: Dispatch<SetStateAction<TooltipState | null>>
}

const GroupRow = memo(function GroupRow({
  row, isCollapsed, toggle, searchQuery,
  rangeStart, totalMs, timelineW, nPeriodCols,
  setTooltip,
}: GroupRowProps) {
  return (
    <tr className={row.rowClass} style={{ height: ROW_H }}>
      <td className="gantt-sticky">
        <div className="gantt-sticky-cell">
          <div className="gantt-sticky-name">
            <div className="gantt-name-cell" style={{ paddingLeft: row.indent }}>
              <button className="gantt-toggle" onClick={() => toggle(row.collapseKey)}>
                {isCollapsed
                  ? <ChevronRight size={14} strokeWidth={1.5} />
                  : <ChevronDown size={14} strokeWidth={1.5} />}
              </button>
              <span className={row.nameClass} title={row.label}>{highlightMatch(row.label, searchQuery)}</span>
            </div>
          </div>
          <div className="gantt-sticky-status"><StatusPill state={row.status} /></div>
          <div className="gantt-sticky-exec">{Math.round(row.pct)}%</div>
        </div>
      </td>
      <td
        className="gantt-tl-td gantt-tl-hoverable"
        style={{ width: timelineW, minWidth: timelineW }}
        colSpan={nPeriodCols}
        onMouseEnter={(e) => setTooltip({
          name: row.label,
          bs: row.bs, bf: row.bf, rs: row.rs, rf: row.rf,
          pct: Math.round(row.pct),
          pct_prev: rollupPctPrev(row.n4leaves, TODAY),
          rowState: row.status,
          childCount: row.n4leaves.length,
          x: e.clientX, y: e.clientY,
        })}
        onMouseMove={(e) => setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
        onMouseLeave={() => setTooltip(null)}
      >
        <GanttBar start={row.bs} end={row.bf} rangeStart={rangeStart} totalMs={totalMs} variant="baseline" lane="top"    status={row.status} />
        <GanttBar start={row.rs} end={row.rf} rangeStart={rangeStart} totalMs={totalMs} variant="real"     lane="bottom" status={row.status} />
      </td>
      <td className="gantt-filler-td" />
    </tr>
  )
})

// ── ActivityRow ────────────────────────────────────────────────
interface ActivityRowProps {
  row: Extract<GanttFlatRow, { kind: 'activity' }>
  searchQuery: string
  rangeStart: Date
  totalMs: number
  timelineW: number
  nPeriodCols: number
  setTooltip: Dispatch<SetStateAction<TooltipState | null>>
}

const ActivityRow = memo(function ActivityRow({
  row, searchQuery,
  rangeStart, totalMs, timelineW, nPeriodCols,
  setTooltip,
}: ActivityRowProps) {
  return (
    <tr className={row.rowClass} style={{ height: ROW_H }}>
      <td className="gantt-sticky">
        <div className="gantt-sticky-cell">
          <div className="gantt-sticky-name">
            <div className="gantt-name-cell" style={{ paddingLeft: row.indent }}>
              <span className={row.nameClass} title={row.act.name}>{highlightMatch(row.act.name, searchQuery)}</span>
            </div>
          </div>
          <div className="gantt-sticky-status"><StatusPill state={row.status} /></div>
          <div className="gantt-sticky-exec">{Math.round(row.pct)}%</div>
        </div>
      </td>
      <td
        className="gantt-tl-td gantt-tl-hoverable"
        style={{ width: timelineW, minWidth: timelineW }}
        colSpan={nPeriodCols}
        onMouseEnter={(e) => setTooltip({
          name: row.act.name,
          bs: row.bs, bf: row.bf, rs: row.rs, rf: row.rf,
          pct: row.pct,
          pct_prev: leafPctPrev(row.act, TODAY),
          rowState: row.status,
          childCount: null,
          x: e.clientX, y: e.clientY,
        })}
        onMouseMove={(e) => setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
        onMouseLeave={() => setTooltip(null)}
      >
        <GanttBar start={row.bs} end={row.bf} rangeStart={rangeStart} totalMs={totalMs} variant="baseline" lane="top"    status={row.status} />
        <GanttBar start={row.rs ?? row.bs} end={row.rf ?? row.bf} rangeStart={rangeStart} totalMs={totalMs} variant="real" lane="bottom" status={row.status} />
      </td>
      <td className="gantt-filler-td" />
    </tr>
  )
})

// ── Main component ─────────────────────────────────────────────
export default function Gantt() {
  const { filters, getFilteredActivities } = useFilters()
  const labels = useProgramLabels(filters.programIds.length === 1 ? filters.programIds[0] : null)
  const { activities: rawActivities, loading } = useActivities({ program_id: filters.programIds[0] })
  const activities = useMemo(
    () => filters.cutoffDate ? rawActivities.map(a => applyStatusCutoff(a, filters.cutoffDate!)) : rawActivities,
    [rawActivities, filters.cutoffDate],
  )
  const { programs } = usePrograms()
  const { dependencies } = useActivityDependencies()
  const { planos } = usePlanos(filters.programIds[0])
  const { eixos } = useEixos(filters.programIds[0])
  const { hasAccess } = usePermissions()
  const multiProg = programs.length > 1

  const eff = useEffectiveValues(activities, TODAY)
  const bandResolver = useBandResolver()

  const programSortMap = useMemo(
    () => new Map(programs.map(p => [p.id, p.sort_order] as [string, number])),
    [programs],
  )
  const eixoSortMap = useMemo(
    () => new Map(eixos.map(e => [`${e.program_id}:${e.name}`, e.sort_order] as [string, number])),
    [eixos],
  )
  const planoSortMap = useMemo(
    () => new Map(planos.map(p => [p.id, p.sort_order] as [string, number])),
    [planos],
  )

  const accessiblePlanIds = useMemo(
    () => new Set(planos.filter(p => hasAccess('gantt', p.program_id ?? undefined, p.id)).map(p => p.id)),
    [planos, hasAccess],
  )

  const filtered = useMemo(() => {
    const fc = getFilteredActivities(activities)
    if (planos.length === 0) return fc
    return fc.filter(a => !a.plano_id || accessiblePlanIds.has(a.plano_id))
  }, [activities, getFilteredActivities, accessiblePlanIds, planos.length])

  const [searchQuery, setSearchQuery]   = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<RowState>>(
    () => new Set<RowState>(['Concluída', 'Em dia', 'Em risco', 'Em atraso'])
  )

  const searchFilteredActs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return filtered
    return filtered.filter(a => a.name.toLowerCase().includes(q))
  }, [filtered, searchQuery])

  const finalActs = useMemo(() => {
    if (statusFilter.size === 4) return searchFilteredActs
    return searchFilteredActs.filter(a => {
      if (a.level < 4) return true
      return statusFilter.has(eff.get(a.id)?.status ?? 'Em dia')
    })
  }, [searchFilteredActs, statusFilter, eff])

  const sortedActivities = useMemo(() => {
    return [...finalActs].sort((a, b) => {
      const pa = programSortMap.get(a.program_id ?? '') ?? Infinity
      const pb = programSortMap.get(b.program_id ?? '') ?? Infinity
      if (pa !== pb) return pa - pb
      const ea = eixoSortMap.get(`${a.program_id}:${a.n1}`) ?? Infinity
      const eb = eixoSortMap.get(`${b.program_id}:${b.n1}`) ?? Infinity
      if (ea !== eb) return ea - eb
      const ka = planoSortMap.get(a.plano_id ?? '') ?? Infinity
      const kb = planoSortMap.get(b.plano_id ?? '') ?? Infinity
      if (ka !== kb) return ka - kb
      if (a.level !== b.level) return a.level - b.level
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
  }, [finalActs, programSortMap, eixoSortMap, planoSortMap])

  const tree  = useMemo(() => buildTree(sortedActivities), [sortedActivities])
  const n0tree = useMemo(
    () => multiProg ? buildProgramTree(sortedActivities, programs) : null,
    [sortedActivities, programs, multiProg]
  )

  const groupDataMap = useMemo(() => {
    const m = new Map<string, GroupData>()
    const allN1groups = n0tree ? n0tree.flatMap(g => g.n1groups) : tree

    const entry = (leaves4: Activity[], allActs: Activity[], level: number): GroupData => {
      const status = computeGroupStatusFromEff(leaves4, eff, level, TODAY, bandResolver)
      const dr = groupDateRange(allActs, eff)
      return { status, bs: dr.bs, bf: dr.bf, rs: dr.rs, rf: dr.rf, pct: groupPct(leaves4, eff) }
    }

    if (n0tree) {
      for (const n0g of n0tree) {
        m.set(`n0:${n0g.progId}`, entry(n0g.allActs.filter(a => a.level === 4), n0g.allActs, 0))
      }
    }
    for (const n1g of allN1groups) {
      m.set(`n1:${n1g.n1}`, entry(n1g.allActs.filter(a => a.level === 4), n1g.allActs, 1))
      for (const n2g of n1g.n2groups) {
        m.set(`n2:${n1g.n1}:${n2g.n2}`, entry(n2g.allActs.filter(a => a.level === 4), n2g.allActs, 2))
        for (const n3g of n2g.n3groups) {
          if (n3g.n3) {
            const n3ch = n3g.acts.filter(a => a.level !== 3)
            m.set(`n3:${n1g.n1}:${n2g.n2}:${n3g.n3}`, entry(n3ch.filter(a => a.level === 4), n3ch, 3))
          }
        }
      }
    }
    return m
  }, [n0tree, tree, eff, bandResolver])

  const [scale, setScale]         = useState<Scale>('Mês')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [tooltip, setTooltip]     = useState<TooltipState | null>(null)

  const toggle = useCallback((key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const collapseAll = useCallback(() => {
    const keys = new Set<string>()
    const n1groups = n0tree ? n0tree.flatMap(g => g.n1groups) : tree
    for (const n1g of n1groups) {
      keys.add(`n1:${n1g.n1}`)
      for (const n2g of n1g.n2groups) {
        keys.add(`n2:${n1g.n1}:${n2g.n2}`)
        for (const n3g of n2g.n3groups) {
          if (n3g.n3) keys.add(`n3:${n1g.n1}:${n2g.n2}:${n3g.n3}`)
        }
      }
    }
    if (n0tree) {
      for (const n0g of n0tree) keys.add(`n0:${n0g.progId}`)
    }
    setCollapsed(keys)
  }, [n0tree, tree])

  const expandAll = useCallback(() => setCollapsed(new Set()), [])

  useEffect(() => {
    if (searchQuery.trim()) setCollapsed(new Set())
  }, [searchQuery])

  const [levelView, setLevelView] = useState<LevelView>('todos')
  const applyLevel = useCallback((level: LevelView) => {
    setLevelView(level)
    setCollapsed(buildLevelKeys(level, n0tree, tree))
  }, [n0tree, tree])

  const { rangeStartMs, totalMs, periods, todayPct } = useMemo(() => {
    const dr = computeDateRange(filtered)
    if (!dr) return { rangeStartMs: 0, totalMs: 0, periods: [] as Period[], todayPct: -1 }
    const { rangeStart: rs, rangeEnd } = dr
    const rangeStartMs = rs.getTime()
    const totalMs  = rangeEnd.getTime() - rangeStartMs
    const periods  = buildPeriods(rs, rangeEnd, scale)
    const todayPct = totalMs > 0 ? ((Date.now() - rangeStartMs) / totalMs) * 100 : -1
    return { rangeStartMs, totalMs, periods, todayPct }
  }, [filtered, scale])

  // Stable Date reference — only a new object when the timestamp actually changes,
  // so row memos (GanttBar receives rangeStart) don't invalidate on every activities refetch
  const rangeStart = useMemo(() => new Date(rangeStartMs), [rangeStartMs])

  const colW        = COL_WIDTH[scale]
  const nPeriodCols = Math.max(periods.length, 1)
  const timelineW   = nPeriodCols * colW

  // ── Row identity cache — persists across flatRows recomputes ──
  const rowCacheRef = useRef(new Map<string, GanttFlatRow>())

  // ── Flat row model (replaces renderN1Rows + rows JSX array) ───
  const flatRows = useMemo((): GanttFlatRow[] => {
    const rows: GanttFlatRow[] = []

    const pushN1Rows = (n1groups: N1Group[], n1Indent: number) => {
      for (const n1g of n1groups) {
        const n1key = `n1:${n1g.n1}`
        const n1d   = groupDataMap.get(n1key) ?? EMPTY_GROUP_DATA
        rows.push({
          kind: 'group', key: n1key,
          rowClass: 'gantt-row-n1', nameClass: 'gantt-name-n1',
          label: n1g.n1, indent: n1Indent, collapseKey: n1key,
          status: n1d.status, pct: n1d.pct,
          bs: n1d.bs, bf: n1d.bf,
          rs: n1d.rs ?? n1d.bs, rf: n1d.rf ?? n1d.bf,
          n4leaves: n1g.allActs.filter(a => a.level === 4),
        })
        if (collapsed.has(n1key)) continue

        for (const n2g of n1g.n2groups) {
          const n2key = `n2:${n1g.n1}:${n2g.n2}`
          const n2d   = groupDataMap.get(n2key) ?? EMPTY_GROUP_DATA
          rows.push({
            kind: 'group', key: n2key,
            rowClass: 'gantt-row-n2', nameClass: 'gantt-name-n2',
            label: n2g.n2, indent: n1Indent + 16, collapseKey: n2key,
            status: n2d.status, pct: n2d.pct,
            bs: n2d.bs, bf: n2d.bf,
            rs: n2d.rs ?? n2d.bs, rf: n2d.rf ?? n2d.bf,
            n4leaves: n2g.allActs.filter(a => a.level === 4),
          })
          if (collapsed.has(n2key)) continue

          for (const n3g of n2g.n3groups) {
            // No N3 name: render all acts directly as leaf rows
            if (!n3g.n3) {
              for (const a of n3g.acts) {
                const ev = eff.get(a.id)
                rows.push({
                  kind: 'activity', key: a.id, act: a,
                  rowClass: 'gantt-row-n4', nameClass: 'gantt-name-n4',
                  indent: n1Indent + 32,
                  status: ev?.status ?? 'Em dia', pct: ev?.pct ?? a.pct,
                  bs: ev?.bs ?? null, bf: ev?.bf ?? null,
                  rs: ev?.rs ?? null, rf: ev?.rf ?? null,
                })
              }
              continue
            }

            const n3ChildLeaves = n3g.acts.filter(a => a.level !== 3)
            const n3HasChildren = n3ChildLeaves.length > 0

            if (!n3HasChildren) {
              // N3 has no children — render level-3 rep as a single leaf row
              const rep = n3g.acts.find(a => a.level === 3)
              if (rep) {
                const ev = eff.get(rep.id)
                rows.push({
                  kind: 'activity', key: rep.id, act: rep,
                  rowClass: 'gantt-row-n4', nameClass: 'gantt-name-n3',
                  indent: n1Indent + 32,
                  status: ev?.status ?? 'Em dia', pct: ev?.pct ?? rep.pct,
                  bs: ev?.bs ?? null, bf: ev?.bf ?? null,
                  rs: ev?.rs ?? null, rf: ev?.rf ?? null,
                })
              }
              continue
            }

            // Has real children: collapsible N3 header + children
            const n3key    = `n3:${n1g.n1}:${n2g.n2}:${n3g.n3}`
            const n3d      = groupDataMap.get(n3key) ?? EMPTY_GROUP_DATA
            const n3leaves = n3ChildLeaves.filter(a => a.level === 4)
            rows.push({
              kind: 'group', key: n3key,
              rowClass: 'gantt-row-n3', nameClass: 'gantt-name-n3',
              label: n3g.n3, indent: n1Indent + 32, collapseKey: n3key,
              status: n3d.status, pct: n3d.pct,
              bs: n3d.bs, bf: n3d.bf,
              rs: n3d.rs ?? n3d.bs, rf: n3d.rf ?? n3d.bf,
              n4leaves: n3leaves,
            })
            if (collapsed.has(n3key)) continue

            for (const a of n3ChildLeaves) {
              const ev = eff.get(a.id)
              rows.push({
                kind: 'activity', key: a.id, act: a,
                rowClass: 'gantt-row-n4', nameClass: 'gantt-name-n4',
                indent: n1Indent + 48,
                status: ev?.status ?? 'Em dia', pct: ev?.pct ?? a.pct,
                bs: ev?.bs ?? null, bf: ev?.bf ?? null,
                rs: ev?.rs ?? null, rf: ev?.rf ?? null,
              })
            }
          }
        }
      }
    }

    if (n0tree) {
      for (const n0g of n0tree) {
        const n0key = `n0:${n0g.progId}`
        const n0d   = groupDataMap.get(n0key) ?? EMPTY_GROUP_DATA
        rows.push({
          kind: 'group', key: n0key,
          rowClass: 'gantt-row-n0', nameClass: 'gantt-name-n0',
          label: n0g.progName, indent: 4, collapseKey: n0key,
          status: n0d.status, pct: n0d.pct,
          bs: n0d.bs, bf: n0d.bf,
          rs: n0d.rs ?? n0d.bs, rf: n0d.rf ?? n0d.bf,
          n4leaves: n0g.allActs.filter(a => a.level === 4),
        })
        if (!collapsed.has(n0key)) pushN1Rows(n0g.n1groups, 16)
      }
    } else {
      pushN1Rows(tree, 4)
    }

    // Stabilize row object identities — reuse prior object when data is unchanged so
    // React.memo on GroupRow/ActivityRow can bail out for unmodified rows
    const cache = rowCacheRef.current
    const stableRows = rows.map(next => {
      const prev = cache.get(next.key)
      if (prev && shallowEqualRow(prev, next)) return prev
      cache.set(next.key, next)
      return next
    })

    // Prune keys no longer in the list
    const currentKeys = new Set(stableRows.map(r => r.key))
    for (const k of cache.keys()) {
      if (!currentKeys.has(k)) cache.delete(k)
    }

    return stableRows
  }, [n0tree, tree, collapsed, groupDataMap, eff])

  // ── Arrow info map (replaces rowInfoMap) ──────────────────────
  const arrowInfoMap = useMemo(() => {
    const m = new Map<string, RowInfo>()
    for (let i = 0; i < flatRows.length; i++) {
      const r = flatRows[i]
      if (r.kind === 'activity') {
        m.set(r.act.id, {
          id: r.act.id,
          rowIndex: i,
          bs: r.bs ?? r.act.bs,  // ev?.bs ?? a.bs — preserves stored fallback for arrow positioning
          bf: r.bf ?? r.act.bf,
        })
      }
    }
    return m
  }, [flatRows])

  // ── Memoised dependency arrows ─────────────────────────────────
  const arrows = useMemo((): Arrow[] => {
    if (totalMs <= 0) return []
    const result: Arrow[] = []
    for (const dep of dependencies) {
      const pred = arrowInfoMap.get(dep.predecessor_id)
      const suc  = arrowInfoMap.get(dep.successor_id)
      if (!pred || !suc) continue
      const fromDateStr = dep.dep_type === 'FS' || dep.dep_type === 'FF' ? pred.bf : pred.bs
      const toDateStr   = dep.dep_type === 'FS' || dep.dep_type === 'SS' ? suc.bs  : suc.bf
      if (!fromDateStr || !toDateStr) continue
      const ms = rangeStart.getTime()
      result.push({
        id: dep.id,
        fromX: ((new Date(fromDateStr).getTime() - ms) / totalMs) * timelineW,
        fromY: pred.rowIndex * ROW_H + ROW_H / 2,
        toX:   ((new Date(toDateStr).getTime()   - ms) / totalMs) * timelineW,
        toY:   suc.rowIndex  * ROW_H + ROW_H / 2,
        depType: dep.dep_type,
      })
    }
    return result
  }, [arrowInfoMap, dependencies, rangeStart, totalMs, timelineW])

  // ── Virtualizer ────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 20,
  })
  const virtualRows = virtualizer.getVirtualItems()

  return (
    <>
      <Card title="GANTT">
        <div className="gantt-toolbar">
          <div className="gantt-toolbar-left">
            <div className="gi-search">
              <svg className="gi-search-icon" width="14" height="14" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="gi-search-input"
                placeholder="Pesquisar actividades..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="gi-search-clear"
                        onClick={() => setSearchQuery('')}><X size={14} strokeWidth={1.5} /></button>
              )}
            </div>
          </div>
          <div className="gantt-toolbar-right">
            <div className="act-group-wrapper">
              <label className="act-group-label">Agrupar:</label>
              <select className="styled-select" value={levelView}
                      onChange={e => applyLevel(e.target.value as LevelView)}>
                <option value="todos">Todos</option>
                {multiProg && <option value="programa">Programa</option>}
                <option value="eixo">{labels.n1}</option>
                <option value="plano">{labels.n2}</option>
                <option value="macro">Macroactividade</option>
                <option value="actividade">Actividade</option>
              </select>
            </div>
            <StatusFilterDropdown statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
            <div className="act-group-wrapper">
              <label className="act-group-label">Escala:</label>
              <select className="styled-select" value={scale}
                      onChange={e => setScale(e.target.value as Scale)}>
                <option value="Semana">Semana</option>
                <option value="Mês">Mês</option>
                <option value="Trimestre">Trimestre</option>
              </select>
            </div>
            <div className="act-collapse-group">
              <button type="button" className="act-collapse-btn"
                      onClick={collapseAll} title="Colapsar tudo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
              <button type="button" className="act-collapse-btn"
                      onClick={expandAll} title="Expandir tudo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </div>
            <div className="gantt-toolbar-divider" />
            <div className="gantt-legend">
              <span className="gantt-legend-item">
                <span className="gantt-legend-swatch gantt-swatch-baseline" />Baseline
              </span>
              <span className="gantt-legend-item">
                <span className="gantt-legend-swatch" style={{ background: 'var(--status-ontrack)' }} />Em dia
              </span>
              <span className="gantt-legend-item">
                <span className="gantt-legend-swatch" style={{ background: 'var(--status-risk)' }} />Em risco
              </span>
              <span className="gantt-legend-item">
                <span className="gantt-legend-swatch" style={{ background: 'var(--status-late)' }} />Em atraso
              </span>
              <span className="gantt-legend-item">
                <span className="gantt-legend-swatch" style={{ background: 'var(--status-done)' }} />Concluída
              </span>
            </div>
          </div>
        </div>

        {loading && activities.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Spinner />
          </div>
        ) : filtered.length === 0 && activities.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Sem actividades"
            description="Selecciona um programa nos filtros para visualizar o diagrama de Gantt."
          />
        ) : finalActs.length === 0 ? (
          <div className="gantt-empty">
            {searchQuery.trim() ? `Nenhuma actividade encontrada para "${searchQuery}"` : 'Sem actividades para os filtros seleccionados.'}
          </div>
        ) : (
          <div className="gantt-scroll-wrap" ref={scrollRef}>
            <div className="gantt-inner">
              <table
                className="gantt-table"
                style={{ tableLayout: 'fixed', minWidth: '100%' }}
              >
                <colgroup>
                  <col style={{ width: COL_NAME + COL_STATUS + COL_EXEC }} />
                  {periods.map((_, i) => <col key={i} style={{ width: colW }} />)}
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th className="gantt-th gantt-sticky t-label">
                      <div className="gantt-sticky-cell">
                        <div className="gantt-sticky-name" style={{ paddingLeft: 8 }}>Designação</div>
                        <div className="gantt-sticky-status">Estado</div>
                        <div className="gantt-sticky-exec">Exec.</div>
                      </div>
                    </th>
                    {periods.map((p, i) => (
                      <th key={i} className="gantt-th gantt-th-period t-label">{p.label}</th>
                    ))}
                    <th className="gantt-th gantt-th-filler" />
                  </tr>
                </thead>
                <tbody>
                  {/* Top spacer — fills scroll space above visible window */}
                  {virtualRows.length > 0 && (
                    <tr>
                      <td colSpan={nPeriodCols + 2} style={{ height: virtualRows[0].start, padding: 0 }} />
                    </tr>
                  )}
                  {virtualRows.map(vi => {
                    const row = flatRows[vi.index]
                    if (row.kind === 'group') {
                      return (
                        <GroupRow
                          key={vi.key}
                          row={row}
                          isCollapsed={collapsed.has(row.collapseKey)}
                          toggle={toggle}
                          searchQuery={searchQuery}
                          rangeStart={rangeStart}
                          totalMs={totalMs}
                          timelineW={timelineW}
                          nPeriodCols={nPeriodCols}
                          setTooltip={setTooltip}
                        />
                      )
                    }
                    return (
                      <ActivityRow
                        key={vi.key}
                        row={row}
                        searchQuery={searchQuery}
                        rangeStart={rangeStart}
                        totalMs={totalMs}
                        timelineW={timelineW}
                        nPeriodCols={nPeriodCols}
                        setTooltip={setTooltip}
                      />
                    )
                  })}
                  {/* Bottom spacer — fills scroll space below visible window */}
                  {virtualRows.length > 0 && (
                    <tr>
                      <td
                        colSpan={nPeriodCols + 2}
                        style={{
                          height: virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end,
                          padding: 0,
                        }}
                      />
                    </tr>
                  )}
                </tbody>
              </table>
              {/* Grid-lines overlay — single div, repeating gradient tiles at colW; no per-row divs */}
              <div
                className="gantt-grid-overlay"
                style={{
                  position: 'absolute',
                  top: HEADER_H,
                  left: STICKY_W,
                  width: timelineW,
                  height: flatRows.length * ROW_H,
                  pointerEvents: 'none',
                  zIndex: 0,
                  backgroundImage: `repeating-linear-gradient(to right, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${colW}px)`,
                }}
              />
              {/* Today-line overlay — single full-height div; one 'Hoje' label */}
              {todayPct >= 0 && todayPct <= 100 && (
                <div
                  className="gantt-today-line"
                  style={{
                    position: 'absolute',
                    top: HEADER_H,
                    left: STICKY_W + (todayPct / 100) * timelineW,
                    height: flatRows.length * ROW_H,
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                >
                  <span className="gantt-today-label">Hoje</span>
                </div>
              )}
              {arrows.length > 0 && (
                <svg
                  className="gantt-arrows-overlay"
                  style={{
                    position: 'absolute',
                    top: HEADER_H,
                    left: STICKY_W,
                    width: timelineW,
                    height: flatRows.length * ROW_H,
                    pointerEvents: 'none',
                    zIndex: 4,
                    overflow: 'visible',
                  }}
                >
                  <defs>
                    <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M 0 0 L 6 3 L 0 6 z" fill="rgba(101,83,68,0.7)" />
                    </marker>
                  </defs>
                  {arrows.map(a => <ArrowPath key={a.id} arrow={a} />)}
                </svg>
              )}
            </div>
          </div>
        )}
      </Card>

      {tooltip && <GanttTooltip tooltip={tooltip} />}
    </>
  )
}
