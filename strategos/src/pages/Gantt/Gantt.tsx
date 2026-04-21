import './Gantt.css'
import { useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect, type ReactNode } from 'react'
import Spinner from '../../components/Spinner/Spinner'
import Card from '../../components/Card/Card'
import EmptyState from '../../components/EmptyState/EmptyState'
import { useActivities } from '../../hooks/useActivities'
import { usePrograms } from '../../hooks/usePrograms'
import { useFilters } from '../../context/FilterContext'
import { rollupPct, leafPctPrev, rollupPctPrev, computeRowState, type RowState } from '../../lib/rollup'
import type { Activity, Program } from '../../types/index'
import type { DependencyType } from '../../types/index'
import { useActivityDependencies } from '../../hooks/useActivityDependencies'

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

function rowStateForAct(a: Activity): RowState {
  return computeRowState(a.pct, leafPctPrev(a, TODAY))
}
function rowStateForGroup(acts: Activity[]): RowState {
  const leaves = acts.filter(a => a.level === 4)
  return computeRowState(rollupPct(leaves), rollupPctPrev(leaves, TODAY))
}

const PILL_CLASS: Record<RowState, string> = {
  'Concluída': 'done', 'Em dia': 'ontrack', 'Em risco': 'risk', 'Em atraso': 'late',
}

function StatusPill({ state }: { state: RowState }) {
  return <span className={`status-pill ${PILL_CLASS[state]}`}>{state}</span>
}

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

const ALL_FILTER_STATES: { key: RowState; icon: string; color: string }[] = [
  { key: 'Concluída', icon: '✓', color: 'var(--status-done)' },
  { key: 'Em dia',    icon: '◐', color: 'var(--status-ontrack)' },
  { key: 'Em risco',  icon: '⦿', color: 'var(--status-risk)' },
  { key: 'Em atraso', icon: '✕', color: 'var(--status-late)' },
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
// Each level collapses exactly the rows AT that depth, making them the
// visible leaf (folded ▶, no children rendered below).
function buildLevelKeys(
  level: LevelView,
  n0tree: N0Group[] | null,
  tree: N1Group[]
): Set<string> {
  const keys = new Set<string>()
  if (level === 'todos' || level === 'actividade') return keys

  if (level === 'programa') {
    // Collapse N0 rows: program rows fold (▶), eixos not rendered
    if (n0tree) for (const n0g of n0tree) keys.add(`n0:${n0g.progId}`)
    return keys
  }

  const n1groups = n0tree ? n0tree.flatMap(g => g.n1groups) : tree

  if (level === 'eixo') {
    // Collapse N1 rows: eixo rows fold (▶), planos not rendered
    for (const n1g of n1groups) keys.add(`n1:${n1g.n1}`)
  } else if (level === 'plano') {
    // Collapse N2 rows: plano rows fold (▶), macros not rendered
    for (const n1g of n1groups) {
      for (const n2g of n1g.n2groups) keys.add(`n2:${n1g.n1}:${n2g.n2}`)
    }
  } else if (level === 'macro') {
    // Collapse N3 rows: macro rows fold (▶), activities not rendered
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
    // Fix 2: show Monday date as DD/MM instead of week number
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

function groupDateRange(acts: Activity[]) {
  let minBs: string | null = null, maxBf: string | null = null
  let minRs: string | null = null, maxRf: string | null = null
  for (const a of acts) {
    if (a.bs && (!minBs || a.bs < minBs)) minBs = a.bs
    if (a.bf && (!maxBf || a.bf > maxBf)) maxBf = a.bf
    if (a.rs && (!minRs || a.rs < minRs)) minRs = a.rs
    if (a.rf && (!maxRf || a.rf > maxRf)) maxRf = a.rf
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
const STICKY_W = COL_NAME + COL_STATUS + COL_EXEC  // 420px left fixed columns
const HEADER_H = 29          // approximate thead height (7px padding × 2 + 15px text)

// ── Dependency arrow types ─────────────────────────────────────
interface RowInfo { id: string; rowIndex: number; bs: string | null; bf: string | null }
interface Arrow   { id: string; fromX: number; fromY: number; toX: number; toY: number; depType: DependencyType }

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

  // Deviation: prefer rf−bf, fallback rs−bs
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

  // Auto-flip: render off-screen first (opacity 0), measure, then snap into place
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

function GanttBar({ start, end, rangeStart, totalMs, variant, lane, status }: BarProps) {
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
}

// ── Main component ─────────────────────────────────────────────
export default function Gantt() {
  const { filters, getFilteredActivities } = useFilters()
  const { activities, loading } = useActivities({
    program_id: filters.programIds[0],
    cutoffDate: filters.cutoffDate,
  })
  const { programs } = usePrograms()
  const { dependencies } = useActivityDependencies()
  const multiProg = programs.length > 1

  const filtered = useMemo(() => getFilteredActivities(activities), [activities, getFilteredActivities])

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
      return statusFilter.has(rowStateForAct(a))
    })
  }, [searchFilteredActs, statusFilter])

  const tree  = useMemo(() => buildTree(finalActs), [finalActs])
  const n0tree = useMemo(
    () => multiProg ? buildProgramTree(finalActs, programs) : null,
    [finalActs, programs, multiProg]
  )

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

  const { rangeStart, totalMs, periods, todayPct } = useMemo(() => {
    const dr = computeDateRange(filtered)
    if (!dr) return { rangeStart: new Date(), totalMs: 0, periods: [] as Period[], todayPct: -1 }
    const { rangeStart, rangeEnd } = dr
    const totalMs  = rangeEnd.getTime() - rangeStart.getTime()
    const periods  = buildPeriods(rangeStart, rangeEnd, scale)
    const todayPct = totalMs > 0 ? ((Date.now() - rangeStart.getTime()) / totalMs) * 100 : -1
    return { rangeStart, totalMs, periods, todayPct }
  }, [filtered, scale])

  const colW        = COL_WIDTH[scale]
  const nPeriodCols = Math.max(periods.length, 1)
  const timelineW   = nPeriodCols * colW

  // ── Timeline cell factory ──────────────────────────────────────
  function makeTimeline(
    bs: string | null, bf: string | null,
    rs: string | null, rf: string | null,
    status: RowState,
    act: Activity | null,
    showTodayLabel = false,
    tooltipGroup?: { name: string; leaves: Activity[] },
  ): JSX.Element {
    let onEnter: ((e: React.MouseEvent) => void) | null = null
    if (act) {
      onEnter = (e: React.MouseEvent) => setTooltip({
        name: act.name, bs: act.bs, bf: act.bf, rs: act.rs, rf: act.rf,
        pct: act.pct, pct_prev: leafPctPrev(act, TODAY),
        rowState: rowStateForAct(act),
        childCount: null,
        x: e.clientX, y: e.clientY,
      })
    } else if (tooltipGroup) {
      const { name, leaves } = tooltipGroup
      onEnter = (e: React.MouseEvent) => setTooltip({
        name, bs, bf, rs, rf,
        pct: Math.round(rollupPct(leaves)),
        pct_prev: rollupPctPrev(leaves, TODAY),
        rowState: status,
        childCount: leaves.length,
        x: e.clientX, y: e.clientY,
      })
    }
    const handlers = onEnter ? {
      onMouseEnter: onEnter,
      onMouseMove:  (e: React.MouseEvent) => setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null),
      onMouseLeave: () => setTooltip(null),
    } : {}

    return (
      <td
        key="tl"
        className={`gantt-tl-td${(act || tooltipGroup) ? ' gantt-tl-hoverable' : ''}`}
        style={{ width: timelineW, minWidth: timelineW }}
        colSpan={nPeriodCols}
        {...handlers}
      >
        {/* Period grid lines */}
        {periods.map((_, i) => i > 0 && (
          <div key={i} className="gantt-grid-line" style={{ left: `${(i / periods.length) * 100}%` }} />
        ))}
        {/* Today marker — line on every row, label shown once on first row */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div className="gantt-today-line" style={{ left: `${todayPct}%` }}>
            {showTodayLabel && <span className="gantt-today-label">Hoje</span>}
          </div>
        )}
        {/* Bars */}
        <GanttBar start={bs} end={bf} rangeStart={rangeStart} totalMs={totalMs} variant="baseline" lane="top"    status={status} />
        <GanttBar start={rs} end={rf} rangeStart={rangeStart} totalMs={totalMs} variant="real"     lane="bottom" status={status} />
      </td>
    )
  }

  // ── Build rows ─────────────────────────────────────────────────
  const rows: JSX.Element[] = []
  const visibleActs: RowInfo[] = []
  let rowIdx = 0
  let firstRow = true

  // Inner helper — pushes N1/N2/N3/N4 rows into `rows`.
  // n1Indent: paddingLeft for N1; subsequent levels add 16px each.
  const renderN1Rows = (n1groups: N1Group[], n1Indent: number) => {
    for (const n1g of n1groups) {
      const n1key = `n1:${n1g.n1}`
      const n1col = collapsed.has(n1key)
      const n1st  = rowStateForGroup(n1g.allActs)
      const n1dr  = groupDateRange(n1g.allActs)
      const showLabel = firstRow; firstRow = false

      rows.push(
        <tr key={n1key} className="gantt-row-n1">
          <td className="gantt-sticky">
            <div className="gantt-sticky-cell">
              <div className="gantt-sticky-name">
                <div className="gantt-name-cell" style={{ paddingLeft: n1Indent }}>
                  <button className="gantt-toggle" onClick={() => toggle(n1key)}>{n1col ? '▶' : '▼'}</button>
                  <span className="gantt-name-n1" title={n1g.n1}>{highlightMatch(n1g.n1, searchQuery)}</span>
                </div>
              </div>
              <div className="gantt-sticky-status"><StatusPill state={n1st} /></div>
              <div className="gantt-sticky-exec">{Math.round(rollupPct(n1g.allActs.filter(a => a.level === 4)))}%</div>
            </div>
          </td>
          {makeTimeline(n1dr.bs, n1dr.bf, n1dr.rs, n1dr.rf, n1st, null, showLabel,
            { name: n1g.n1, leaves: n1g.allActs.filter(a => a.level === 4) })}
          <td className="gantt-filler-td" />
        </tr>
      )
      rowIdx++
      if (n1col) continue

      for (const n2g of n1g.n2groups) {
        const n2key = `n2:${n1g.n1}:${n2g.n2}`
        const n2col = collapsed.has(n2key)
        const n2st  = rowStateForGroup(n2g.allActs)
        const n2dr  = groupDateRange(n2g.allActs)

        rows.push(
          <tr key={n2key} className="gantt-row-n2">
            <td className="gantt-sticky">
              <div className="gantt-sticky-cell">
                <div className="gantt-sticky-name">
                  <div className="gantt-name-cell" style={{ paddingLeft: n1Indent + 16 }}>
                    <button className="gantt-toggle" onClick={() => toggle(n2key)}>{n2col ? '▶' : '▼'}</button>
                    <span className="gantt-name-n2" title={n2g.n2}>{highlightMatch(n2g.n2, searchQuery)}</span>
                  </div>
                </div>
                <div className="gantt-sticky-status"><StatusPill state={n2st} /></div>
                <div className="gantt-sticky-exec">{Math.round(rollupPct(n2g.allActs.filter(a => a.level === 4)))}%</div>
              </div>
            </td>
            {makeTimeline(n2dr.bs, n2dr.bf, n2dr.rs, n2dr.rf, n2st, null, false,
              { name: n2g.n2, leaves: n2g.allActs.filter(a => a.level === 4) })}
            <td className="gantt-filler-td" />
          </tr>
        )
        rowIdx++
        if (n2col) continue

        for (const n3g of n2g.n3groups) {
          // ── No N3 name: render all acts directly as leaf rows ──
          if (!n3g.n3) {
            for (const a of n3g.acts) {
              const ast = rowStateForAct(a)
              rows.push(
                <tr key={a.id} className="gantt-row-n4">
                  <td className="gantt-sticky">
                    <div className="gantt-sticky-cell">
                      <div className="gantt-sticky-name">
                        <div className="gantt-name-cell" style={{ paddingLeft: n1Indent + 32 }}>
                          <span className="gantt-name-n4" title={a.name}>{highlightMatch(a.name, searchQuery)}</span>
                        </div>
                      </div>
                      <div className="gantt-sticky-status"><StatusPill state={ast} /></div>
                      <div className="gantt-sticky-exec">{a.pct}%</div>
                    </div>
                  </td>
                  {makeTimeline(a.bs, a.bf, a.rs, a.rf, ast, a)}
                  <td className="gantt-filler-td" />
                </tr>
              )
              visibleActs.push({ id: a.id, rowIndex: rowIdx, bs: a.bs, bf: a.bf })
              rowIdx++
            }
            continue
          }

          // ── N3 has a name: exclude the level-3 representative from children ──
          const n3ChildLeaves = n3g.acts.filter(a => a.level !== 3)
          const n3HasChildren = n3ChildLeaves.length > 0

          if (!n3HasChildren) {
            // N3 has no children — render only the level-3 representative as a single leaf row
            const rep = n3g.acts.find(a => a.level === 3)
            if (!rep) continue
            const ast = rowStateForAct(rep)
            rows.push(
              <tr key={rep.id} className="gantt-row-n4">
                <td className="gantt-sticky">
                  <div className="gantt-sticky-cell">
                    <div className="gantt-sticky-name">
                      <div className="gantt-name-cell" style={{ paddingLeft: n1Indent + 32 }}>
                        <span className="gantt-name-n3" title={rep.name}>{highlightMatch(rep.name, searchQuery)}</span>
                      </div>
                    </div>
                    <div className="gantt-sticky-status"><StatusPill state={ast} /></div>
                    <div className="gantt-sticky-exec">{rep.pct}%</div>
                  </div>
                </td>
                {makeTimeline(rep.bs, rep.bf, rep.rs, rep.rf, ast, rep)}
                <td className="gantt-filler-td" />
              </tr>
            )
            visibleActs.push({ id: rep.id, rowIndex: rowIdx, bs: rep.bs, bf: rep.bf })
            rowIdx++
            continue
          }

          // ── Has real children: render collapsible N3 header + children only ──
          const n3key = `n3:${n1g.n1}:${n2g.n2}:${n3g.n3}`
          const n3col = collapsed.has(n3key)
          const n3st  = rowStateForGroup(n3ChildLeaves)
          const n3dr  = groupDateRange(n3ChildLeaves)

          rows.push(
            <tr key={n3key} className="gantt-row-n3">
              <td className="gantt-sticky">
                <div className="gantt-sticky-cell">
                  <div className="gantt-sticky-name">
                    <div className="gantt-name-cell" style={{ paddingLeft: n1Indent + 32 }}>
                      <button className="gantt-toggle" onClick={() => toggle(n3key)}>{n3col ? '▶' : '▼'}</button>
                      <span className="gantt-name-n3" title={n3g.n3}>{highlightMatch(n3g.n3, searchQuery)}</span>
                    </div>
                  </div>
                  <div className="gantt-sticky-status"><StatusPill state={n3st} /></div>
                  <div className="gantt-sticky-exec">{Math.round(rollupPct(n3ChildLeaves.filter(a => a.level === 4)))}%</div>
                </div>
              </td>
              {makeTimeline(n3dr.bs, n3dr.bf, n3dr.rs, n3dr.rf, n3st, null, false,
                { name: n3g.n3, leaves: n3ChildLeaves.filter(a => a.level === 4) })}
              <td className="gantt-filler-td" />
            </tr>
          )
          rowIdx++
          if (n3col) continue

          // Render only the real children — the N3 representative is excluded to avoid duplicates
          for (const a of n3ChildLeaves) {
            const ast = rowStateForAct(a)
            rows.push(
              <tr key={a.id} className="gantt-row-n4">
                <td className="gantt-sticky">
                  <div className="gantt-sticky-cell">
                    <div className="gantt-sticky-name">
                      <div className="gantt-name-cell" style={{ paddingLeft: n1Indent + 48 }}>
                        <span className="gantt-name-n4" title={a.name}>{highlightMatch(a.name, searchQuery)}</span>
                      </div>
                    </div>
                    <div className="gantt-sticky-status"><StatusPill state={ast} /></div>
                    <div className="gantt-sticky-exec">{a.pct}%</div>
                  </div>
                </td>
                {makeTimeline(a.bs, a.bf, a.rs, a.rf, ast, a)}
                <td className="gantt-filler-td" />
              </tr>
            )
            visibleActs.push({ id: a.id, rowIndex: rowIdx, bs: a.bs, bf: a.bf })
            rowIdx++
          }
        }
      }
    }
  }

  if (n0tree) {
    // Multi-program: N0 group header + indented N1 subtree
    for (const n0g of n0tree) {
      const n0key = `n0:${n0g.progId}`
      const n0col = collapsed.has(n0key)
      const n0st  = rowStateForGroup(n0g.allActs)
      const n0dr  = groupDateRange(n0g.allActs)
      const showLabel = firstRow; firstRow = false

      rows.push(
        <tr key={n0key} className="gantt-row-n0">
          <td className="gantt-sticky">
            <div className="gantt-sticky-cell">
              <div className="gantt-sticky-name">
                <div className="gantt-name-cell" style={{ paddingLeft: 4 }}>
                  <button className="gantt-toggle" onClick={() => toggle(n0key)}>{n0col ? '▶' : '▼'}</button>
                  <span className="gantt-name-n0" title={n0g.progName}>{highlightMatch(n0g.progName, searchQuery)}</span>
                </div>
              </div>
              <div className="gantt-sticky-status"><StatusPill state={n0st} /></div>
              <div className="gantt-sticky-exec">{Math.round(rollupPct(n0g.allActs.filter(a => a.level === 4)))}%</div>
            </div>
          </td>
          {makeTimeline(n0dr.bs, n0dr.bf, n0dr.rs, n0dr.rf, n0st, null, showLabel,
            { name: n0g.progName, leaves: n0g.allActs.filter(a => a.level === 4) })}
          <td className="gantt-filler-td" />
        </tr>
      )
      rowIdx++

      if (!n0col) renderN1Rows(n0g.n1groups, 16)
    }
  } else {
    // Single program (or no programs): existing behaviour, no N0 header
    renderN1Rows(tree, 4)
  }

  // ── Dependency arrows ──────────────────────────────────────────
  const xForDate = (d: string | null): number => {
    if (!d || totalMs <= 0) return 0
    return ((new Date(d).getTime() - rangeStart.getTime()) / totalMs) * timelineW
  }

  const rowsByActId = new Map(visibleActs.map(r => [r.id, r]))
  const arrows: Arrow[] = []
  for (const dep of dependencies) {
    const pred = rowsByActId.get(dep.predecessor_id)
    const suc  = rowsByActId.get(dep.successor_id)
    if (!pred || !suc) continue
    const fromDateStr = dep.dep_type === 'FS' || dep.dep_type === 'FF' ? pred.bf : pred.bs
    const toDateStr   = dep.dep_type === 'FS' || dep.dep_type === 'SS' ? suc.bs  : suc.bf
    if (!fromDateStr || !toDateStr) continue
    const fromX = xForDate(fromDateStr)
    const toX   = xForDate(toDateStr)
    const fromY = pred.rowIndex * ROW_H + ROW_H / 2
    const toY   = suc.rowIndex  * ROW_H + ROW_H / 2
    arrows.push({ id: dep.id, fromX, fromY, toX, toY, depType: dep.dep_type })
  }

  return (
    <>
      <Card title="GANTT">
        {/* Fix 1: Toolbar with navy background, inside card body bleeding edge-to-edge */}
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
                        onClick={() => setSearchQuery('')}>×</button>
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
                <option value="eixo">Eixo</option>
                <option value="plano">Plano</option>
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
          </div>
        </div>
        <div className="gantt-legend-row">
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
          <div className="gantt-scroll-wrap">
            <div className="gantt-inner">
              <table
                className="gantt-table"
                style={{ tableLayout: 'fixed', minWidth: '100%' }}
              >
                <colgroup>
                  <col style={{ width: COL_NAME + COL_STATUS + COL_EXEC }} />
                  {periods.map((_, i) => <col key={i} style={{ width: colW }} />)}
                  <col /> {/* filler: absorbs remaining card width */}
                </colgroup>
                <thead>
                  <tr>
                    <th className="gantt-th gantt-sticky">
                      <div className="gantt-sticky-cell">
                        <div className="gantt-sticky-name" style={{ paddingLeft: 8 }}>Designação</div>
                        <div className="gantt-sticky-status">Estado</div>
                        <div className="gantt-sticky-exec">Exec.</div>
                      </div>
                    </th>
                    {periods.map((p, i) => (
                      <th key={i} className="gantt-th gantt-th-period">{p.label}</th>
                    ))}
                    {/* Issue 4: filler header — empty, navy bg extends to right edge */}
                    <th className="gantt-th gantt-th-filler" />
                  </tr>
                </thead>
                <tbody>{rows}</tbody>
              </table>
              {arrows.length > 0 && (
                <svg
                  className="gantt-arrows-overlay"
                  style={{
                    position: 'absolute',
                    top: HEADER_H,
                    left: STICKY_W,
                    width: timelineW,
                    height: rowIdx * ROW_H,
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
