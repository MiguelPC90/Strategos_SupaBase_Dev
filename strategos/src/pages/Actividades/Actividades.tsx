import './Actividades.css'
import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { Link2, ChevronDown, ChevronRight, X, Check, CheckCircle2, CircleDot, AlertCircle, XCircle } from 'lucide-react'
import Spinner from '../../components/Spinner/Spinner'
import Card from '../../components/Card/Card'
import KpiCard from '../../components/KpiCard/KpiCard'
import EmptyState from '../../components/EmptyState/EmptyState'
import { useActivities } from '../../hooks/useActivities'
import { usePrograms } from '../../hooks/usePrograms'
import { useThresholdsMap } from '../../hooks/useThresholdsMap'
import { useFilters } from '../../context/FilterContext'
import { useProgramLabels } from '../../hooks/useProgramLabels'
import { useActivityDependencies } from '../../hooks/useActivityDependencies'
import { usePlanos } from '../../hooks/usePlanos'
import { usePermissions } from '../../hooks/usePermissions'
import type { Activity, Program } from '../../types/index'
import type { PlanoThresholds } from '../../hooks/useThresholdsMap'
import { leafPctPrev, leafStatus, computeRowState, type RowState } from '../../lib/rollup'

const TODAY = new Date().toISOString().slice(0, 10)
const ALL_STATUS_KEYS: RowState[] = ['Concluída', 'Em dia', 'Em risco', 'Em atraso']

// ── Status helpers ─────────────────────────────────────────────
type StatusCls = 'concluida' | 'em_dia' | 'em_risco' | 'em_atraso'
type LevelView  = 'todos' | 'programa' | 'eixo' | 'plano' | 'macro' | 'actividade'

function actStatus(a: Activity, tLeaves: number = 0): StatusCls {
  const s = leafStatus(a, TODAY, tLeaves)
  if (s === 'Concluída') return 'concluida'
  if (s === 'Em risco')  return 'em_risco'
  if (s === 'Em atraso') return 'em_atraso'
  return 'em_dia'
}

const STATE_PILL_CLASS: Record<RowState, string> = {
  'Concluída': 'done',
  'Em dia':    'ontrack',
  'Em risco':  'risk',
  'Em atraso': 'late',
}

const STATE_LABEL: Record<RowState, string> = {
  'Concluída': 'Concluída',
  'Em dia':    'Em dia',
  'Em risco':  'Em risco',
  'Em atraso': 'Em atraso',
}

const STATE_FILL: Record<RowState, string> = {
  'Concluída': 'var(--status-done)',
  'Em dia':    'var(--status-ontrack)',
  'Em risco':  'var(--status-risk)',
  'Em atraso': 'var(--status-late)',
}

// ── Stats computation ──────────────────────────────────────────
interface Stats {
  total: number
  concluidas: number
  em_dia: number
  em_risco: number
  em_atraso: number
  exec: number
  exec_obj: number
  latest_end: string | null
}

function computeStats(
  acts: Activity[],
  thresholdsMap?: Map<string, PlanoThresholds>,
): Stats {
  const total = acts.length
  let concluidas = 0, em_dia = 0, em_risco = 0, em_atraso = 0, sumPct = 0, sumPrev = 0
  let latest_end: string | null = null
  for (const a of acts) {
    const tLeaves = thresholdsMap?.get(a.plano_id ?? '')?.leaves ?? 0
    const s = actStatus(a, tLeaves)
    if (s === 'concluida') concluidas++
    else if (s === 'em_dia') em_dia++
    else if (s === 'em_risco') em_risco++
    else em_atraso++
    sumPct  += a.pct
    sumPrev += leafPctPrev(a, TODAY)
    const end = a.rf ?? a.bf
    if (end && (!latest_end || end > latest_end)) latest_end = end
  }
  return {
    total, concluidas, em_dia, em_risco, em_atraso,
    exec:     total > 0 ? sumPct  / total : 0,
    exec_obj: total > 0 ? sumPrev / total : 0,
    latest_end,
  }
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

// ── Search helpers ─────────────────────────────────────────────
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&')
}

function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="gi-search-highlight">{part}</mark>
      : part
  )
}

// ── Status filter dropdown ─────────────────────────────────────
const STATUS_FILTER_ITEMS: { key: RowState; label: string; icon: ReactNode; color: string }[] = [
  { key: 'Concluída', label: 'Concluídas', icon: <CheckCircle2 size={12} strokeWidth={1.5} />, color: 'var(--status-done)' },
  { key: 'Em dia',    label: 'Em dia',     icon: <CircleDot size={12} strokeWidth={1.5} />,    color: 'var(--status-ontrack)' },
  { key: 'Em risco',  label: 'Em risco',   icon: <AlertCircle size={12} strokeWidth={1.5} />,  color: 'var(--status-risk)' },
  { key: 'Em atraso', label: 'Em atraso',  icon: <XCircle size={12} strokeWidth={1.5} />,      color: 'var(--status-late)' },
]

interface StatusFilterDropdownProps {
  filter: Set<RowState>
  setFilter: React.Dispatch<React.SetStateAction<Set<RowState>>>
}

function StatusFilterDropdown({ filter, setFilter }: StatusFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const toggle = (key: RowState) => {
    setFilter(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const label = filter.size === ALL_STATUS_KEYS.length
    ? 'Estado: Todos'
    : filter.size === 0 ? 'Estado: Nenhum' : `Estado: ${filter.size}`

  return (
    <div className="act-statusfilter" ref={ref}>
      <button type="button" className="act-statusfilter-btn" onClick={() => setOpen(o => !o)}>
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="act-statusfilter-popup">
          {STATUS_FILTER_ITEMS.map(s => (
            <label key={s.key} className="act-statusfilter-option">
              <input type="checkbox" checked={filter.has(s.key)} onChange={() => toggle(s.key)} />
              <span className="act-statusfilter-icon" style={{ color: s.color }}>{s.icon}</span>
              <span>{s.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────
function DualBar({ exec, execObj }: { exec: number; execObj: number }) {
  const state = computeRowState(exec, execObj)
  const fillColor = STATE_FILL[state]
  const r = Math.min(100, Math.max(0, exec))
  const p = Math.min(100, Math.max(0, execObj))
  return (
    <div className="act-dualbar">
      <div className="act-dualbar-track">
        <div className="act-dualbar-prev" style={{ width: `${p}%` }} />
        <div className="act-dualbar-real" style={{ width: `${r}%`, background: fillColor }} />
      </div>
      <span className="act-dualbar-label" style={{ color: fillColor, fontWeight: 600 }}>
        {Math.round(r)}%<span style={{ color: 'var(--stratgos-ink-300)', fontWeight: 400 }}>/{Math.round(p)}%</span>
      </span>
    </div>
  )
}

function DeadlineCell({ bf, rf }: { bf: string | null; rf?: string | null }) {
  const fmt = (d: string) => {
    const parts = d.split('-')
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d
  }
  if (!bf && !rf) return <td className="act-td-c act-deadline">—</td>
  if (rf) {
    return (
      <td className="act-td-c act-deadline">
        <div className={`act-prazo-bf${bf && bf < TODAY ? ' late' : ''}`}>{bf ? fmt(bf) : '—'}</div>
        <div className={`act-prazo-rf${rf < TODAY ? ' late' : ''}`}>{fmt(rf)}</div>
      </td>
    )
  }
  return <td className={`act-td-c act-deadline${bf && bf < TODAY ? ' late' : ''}`}>{bf ? fmt(bf) : '—'}</td>
}

function CdaCell({ concluidas, em_dia, em_risco, em_atraso }: { concluidas: number; em_dia: number; em_risco: number; em_atraso: number }) {
  return (
    <td className="act-td-c">
      <div className="act-cda" title={`Concluídas: ${concluidas} · Em dia: ${em_dia} · Em risco: ${em_risco} · Em atraso: ${em_atraso}`}>
        <span className="act-cda-item" style={{ color: 'var(--status-done)' }} title={`Concluídas: ${concluidas}`}>
          <span className="act-cda-icon"><Check size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
          <span>{concluidas}</span>
        </span>
        <span className="act-cda-item" style={{ color: 'var(--status-ontrack)' }} title={`Em dia: ${em_dia}`}>
          <span className="act-cda-icon"><CircleDot size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
          <span>{em_dia}</span>
        </span>
        <span className="act-cda-item" style={{ color: 'var(--status-risk)' }} title={`Em risco: ${em_risco}`}>
          <span className="act-cda-icon"><AlertCircle size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
          <span>{em_risco}</span>
        </span>
        <span className="act-cda-item" style={{ color: 'var(--status-late)' }} title={`Em atraso: ${em_atraso}`}>
          <span className="act-cda-icon"><XCircle size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
          <span>{em_atraso}</span>
        </span>
      </div>
    </td>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function Actividades() {
  const { filters, getFilteredActivities } = useFilters()
  const labels = useProgramLabels(filters.programIds.length === 1 ? filters.programIds[0] : null)
  const { activities, loading } = useActivities({
    program_id: filters.programIds[0],
    cutoffDate: filters.cutoffDate,
  })
  const { programs } = usePrograms()
  const thresholdsMap = useThresholdsMap()
  const { dependencies } = useActivityDependencies()
  const { planos } = usePlanos(filters.programIds[0])
  const { hasAccess } = usePermissions()
  const multiProg = programs.length > 1

  const predecessorCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of dependencies) {
      m.set(d.successor_id, (m.get(d.successor_id) ?? 0) + 1)
    }
    return m
  }, [dependencies])

  const accessiblePlanIds = useMemo(
    () => new Set(planos.filter(p => hasAccess('actividades', p.program_id ?? undefined, p.id)).map(p => p.id)),
    [planos, hasAccess],
  )

  const filtered = useMemo(() => {
    const fc = getFilteredActivities(activities)
    if (planos.length === 0) return fc
    return fc.filter(a => !a.plano_id || accessiblePlanIds.has(a.plano_id))
  }, [activities, getFilteredActivities, accessiblePlanIds, planos.length])

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<RowState>>(() => new Set(ALL_STATUS_KEYS))

  const searchFilteredActs = useMemo(() => {
    if (!searchQuery.trim()) return filtered
    const q = searchQuery.toLowerCase().trim()
    return filtered.filter(a => a.name.toLowerCase().includes(q))
  }, [filtered, searchQuery])

  const finalActs = useMemo(() => {
    if (statusFilter.size === ALL_STATUS_KEYS.length) return searchFilteredActs
    return searchFilteredActs.filter(a => {
      if (a.level < 4) return true
      const tLeaves = thresholdsMap.get(a.plano_id ?? '')?.leaves
      return statusFilter.has(leafStatus(a, TODAY, tLeaves) as RowState)
    })
  }, [searchFilteredActs, statusFilter, thresholdsMap])

  const tree     = useMemo(() => buildTree(finalActs), [finalActs])
  const n0tree   = useMemo(
    () => multiProg ? buildProgramTree(finalActs, programs) : null,
    [finalActs, programs, multiProg]
  )
  const summary  = useMemo(() => computeStats(finalActs.filter(a => a.level === 4), thresholdsMap), [finalActs, thresholdsMap])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Auto-expand while search is active
  useEffect(() => {
    if (searchQuery.trim()) setCollapsed(new Set())
  }, [searchQuery])

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

  const [levelView, setLevelView] = useState<LevelView>('todos')
  const applyLevel = useCallback((level: LevelView) => {
    setLevelView(level)
    setCollapsed(buildLevelKeys(level, n0tree, tree))
  }, [n0tree, tree])

  const rows: ReactNode[] = []

  const renderN1Rows = (n1groups: N1Group[], n1Indent: number) => {
    for (const n1g of n1groups) {
      const n1key    = `n1:${n1g.n1}`
      const n1col    = collapsed.has(n1key)
      const n1leaves = n1g.allActs.filter(a => a.level === 4)
      const n1stats  = computeStats(n1leaves, thresholdsMap)
      const n1state  = computeRowState(n1stats.exec, n1stats.exec_obj)

      rows.push(
        <tr key={n1key} className="act-row-n1">
          <td>
            <div className="act-name-cell" style={{ paddingLeft: n1Indent }}>
              <button className="act-toggle" onClick={() => toggle(n1key)}>
                {n1col ? <ChevronRight size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
              </button>
              <span className="act-name-n1">{highlightMatch(n1g.n1, searchQuery)}</span>
            </div>
          </td>
          <td className="act-td-c">
            <span className={`status-pill ${STATE_PILL_CLASS[n1state]}`}>{STATE_LABEL[n1state]}</span>
          </td>
          <CdaCell {...n1stats} />
          <td className="act-td-c"><DualBar exec={n1stats.exec} execObj={n1stats.exec_obj} /></td>
          <DeadlineCell bf={n1stats.latest_end} />
        </tr>
      )

      if (n1col) continue

      for (const n2g of n1g.n2groups) {
        const n2key    = `n2:${n1g.n1}:${n2g.n2}`
        const n2col    = collapsed.has(n2key)
        const n2leaves = n2g.allActs.filter(a => a.level === 4)
        const n2stats  = computeStats(n2leaves, thresholdsMap)
        const n2state  = computeRowState(n2stats.exec, n2stats.exec_obj)

        rows.push(
          <tr key={n2key} className="act-row-n2">
            <td>
              <div className="act-name-cell" style={{ paddingLeft: n1Indent + 16 }}>
                <button className="act-toggle" onClick={() => toggle(n2key)}>
                  {n2col ? <ChevronRight size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
                </button>
                <span className="act-name-n2">{highlightMatch(n2g.n2, searchQuery)}</span>
              </div>
            </td>
            <td className="act-td-c">
              <span className={`status-pill ${STATE_PILL_CLASS[n2state]}`}>{STATE_LABEL[n2state]}</span>
            </td>
            <CdaCell {...n2stats} />
            <td className="act-td-c"><DualBar exec={n2stats.exec} execObj={n2stats.exec_obj} /></td>
            <DeadlineCell bf={n2stats.latest_end} />
          </tr>
        )

        if (n2col) continue

        for (const n3g of n2g.n3groups) {
          if (!n3g.n3) {
            for (const a of n3g.acts) {
              const pctPrev = leafPctPrev(a, TODAY)
              const ast     = leafStatus(a, TODAY, thresholdsMap.get(a.plano_id ?? '')?.leaves) as RowState
              rows.push(
                <tr key={a.id} className="act-row-n4">
                  <td>
                    <div className="act-name-cell" style={{ paddingLeft: n1Indent + 32 }}>
                      <span className="act-name-n4" title={a.name}>{highlightMatch(a.name, searchQuery)}</span>
                      {(predecessorCounts.get(a.id) ?? 0) > 0 && (
                        <span className="act-dep-chip" title={predecessorCounts.get(a.id) === 1 ? '1 dependência' : `${predecessorCounts.get(a.id)} dependências`}>
                          <Link2 size={11} />{predecessorCounts.get(a.id)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="act-td-c">
                    <span className={`status-pill ${STATE_PILL_CLASS[ast]}`}>{STATE_LABEL[ast]}</span>
                  </td>
                  <td className="act-td-c" />
                  <td className="act-td-c"><DualBar exec={a.pct} execObj={pctPrev} /></td>
                  <DeadlineCell bf={a.bf ?? a.finish ?? null} rf={a.rf ?? null} />
                </tr>
              )
            }
            continue
          }

          const n3ChildLeaves = n3g.acts.filter(a => a.level !== 3)
          const n3HasChildren = n3ChildLeaves.length > 0

          if (!n3HasChildren) {
            for (const a of n3g.acts) {
              const pctPrev = leafPctPrev(a, TODAY)
              const ast     = leafStatus(a, TODAY, thresholdsMap.get(a.plano_id ?? '')?.leaves) as RowState
              rows.push(
                <tr key={a.id} className="act-row-n4">
                  <td>
                    <div className="act-name-cell" style={{ paddingLeft: n1Indent + 32 }}>
                      <span className="act-name-n4" title={a.name}>{highlightMatch(a.name, searchQuery)}</span>
                      {(predecessorCounts.get(a.id) ?? 0) > 0 && (
                        <span className="act-dep-chip" title={predecessorCounts.get(a.id) === 1 ? '1 dependência' : `${predecessorCounts.get(a.id)} dependências`}>
                          <Link2 size={11} />{predecessorCounts.get(a.id)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="act-td-c">
                    <span className={`status-pill ${STATE_PILL_CLASS[ast]}`}>{STATE_LABEL[ast]}</span>
                  </td>
                  <td className="act-td-c" />
                  <td className="act-td-c"><DualBar exec={a.pct} execObj={pctPrev} /></td>
                  <DeadlineCell bf={a.bf ?? a.finish ?? null} rf={a.rf ?? null} />
                </tr>
              )
            }
            continue
          }

          const n3key    = `n3:${n1g.n1}:${n2g.n2}:${n3g.n3}`
          const n3col    = collapsed.has(n3key)
          const n3leaves = n3g.acts.filter(a => a.level === 4)
          const n3stats  = computeStats(n3leaves, thresholdsMap)
          const n3state  = computeRowState(n3stats.exec, n3stats.exec_obj)

          rows.push(
            <tr key={n3key} className="act-row-n3">
              <td>
                <div className="act-name-cell" style={{ paddingLeft: n1Indent + 32 }}>
                  <button className="act-toggle" onClick={() => toggle(n3key)}>
                    {n3col ? <ChevronRight size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
                  </button>
                  <span className="act-name-n3">{highlightMatch(n3g.n3, searchQuery)}</span>
                </div>
              </td>
              <td className="act-td-c">
                <span className={`status-pill ${STATE_PILL_CLASS[n3state]}`}>{STATE_LABEL[n3state]}</span>
              </td>
              <CdaCell {...n3stats} />
              <td className="act-td-c"><DualBar exec={n3stats.exec} execObj={n3stats.exec_obj} /></td>
              <DeadlineCell bf={n3stats.latest_end} />
            </tr>
          )

          if (n3col) continue

          for (const a of n3ChildLeaves) {
            const pctPrev = leafPctPrev(a, TODAY)
            const ast     = leafStatus(a, TODAY, thresholdsMap.get(a.plano_id ?? '')?.leaves) as RowState
            rows.push(
              <tr key={a.id} className="act-row-n4">
                <td>
                  <div className="act-name-cell" style={{ paddingLeft: n1Indent + 48 }}>
                    <span className="act-name-n4" title={a.name}>{highlightMatch(a.name, searchQuery)}</span>
                    {(predecessorCounts.get(a.id) ?? 0) > 0 && (
                      <span className="act-dep-chip" title={predecessorCounts.get(a.id) === 1 ? '1 dependência' : `${predecessorCounts.get(a.id)} dependências`}>
                        <Link2 size={11} />{predecessorCounts.get(a.id)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="act-td-c">
                  <span className={`status-pill ${STATE_PILL_CLASS[ast]}`}>{STATE_LABEL[ast]}</span>
                </td>
                <td className="act-td-c" />
                <td className="act-td-c"><DualBar exec={a.pct} execObj={pctPrev} /></td>
                <DeadlineCell bf={a.bf ?? a.finish ?? null} rf={a.rf ?? null} />
              </tr>
            )
          }
        }
      }
    }
  }

  if (n0tree) {
    for (const n0g of n0tree) {
      const n0key    = `n0:${n0g.progId}`
      const n0col    = collapsed.has(n0key)
      const n0leaves = n0g.allActs.filter(a => a.level === 4)
      const n0stats  = computeStats(n0leaves)
      const n0state  = computeRowState(n0stats.exec, n0stats.exec_obj)

      rows.push(
        <tr key={n0key} className="act-row-n0">
          <td>
            <div className="act-name-cell" style={{ paddingLeft: 4 }}>
              <button className="act-toggle" onClick={() => toggle(n0key)}>
                {n0col ? <ChevronRight size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
              </button>
              <span className="act-name-n0">{highlightMatch(n0g.progName, searchQuery)}</span>
            </div>
          </td>
          <td className="act-td-c">
            <span className={`status-pill ${STATE_PILL_CLASS[n0state]}`}>{STATE_LABEL[n0state]}</span>
          </td>
          <CdaCell {...n0stats} />
          <td className="act-td-c"><DualBar exec={n0stats.exec} execObj={n0stats.exec_obj} /></td>
          <DeadlineCell bf={n0stats.latest_end} />
        </tr>
      )

      if (!n0col) renderN1Rows(n0g.n1groups, 16)
    }
  } else {
    renderN1Rows(tree, 4)
  }

  const filterInfo = filters.n1Values.length > 0
    ? `Filtrado por: ${filters.n1Values.join(', ')}`
    : null

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <KpiCard label="Total actividades" value={summary.total} />
        <KpiCard label="Concluídas"        value={summary.concluidas} color="green" />
        <KpiCard label="Em dia"            value={summary.em_dia}     color="blue" />
        <KpiCard label="Em atraso"         value={summary.em_atraso}  color="red" />
        <KpiCard label="Exec. real"        value={`${Math.round(summary.exec)}%`} color="navy" />
      </div>

      <Card title="Actividades">
        <div className="act-toolbar">
          <div className="act-toolbar-left">
            <div className="gi-search">
              <svg className="gi-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                className="gi-search-input"
                placeholder="Pesquisar actividades..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="gi-search-clear" onClick={() => setSearchQuery('')} title="Limpar pesquisa"><X size={14} strokeWidth={1.5} /></button>
              )}
            </div>
            {filterInfo && <span className="act-filter-info">{filterInfo}</span>}
          </div>

          <div className="act-toolbar-right">
            <div className="act-group-wrapper">
              <label className="act-group-label">Agrupar:</label>
              <select
                className="styled-select"
                value={levelView}
                onChange={e => applyLevel(e.target.value as LevelView)}
              >
                <option value="todos">Todos</option>
                {multiProg && <option value="programa">Programa</option>}
                <option value="eixo">{labels.n1}</option>
                <option value="plano">{labels.n2}</option>
                <option value="macro">Macroactividade</option>
                <option value="actividade">Actividade</option>
              </select>
            </div>

            <StatusFilterDropdown filter={statusFilter} setFilter={setStatusFilter} />

            <div className="act-collapse-group">
              <button type="button" className="act-collapse-btn" onClick={collapseAll} title="Colapsar tudo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20"/>
                  <polyline points="20 10 14 10 14 4"/>
                  <line x1="14" y1="10" x2="21" y2="3"/>
                  <line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </button>
              <button type="button" className="act-collapse-btn" onClick={expandAll} title="Expandir tudo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9"/>
                  <polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/>
                  <line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {loading && activities.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Spinner />
          </div>
        ) : !loading && activities.length === 0 ? (
          <EmptyState
            icon="list"
            title="Sem actividades"
            description="Selecciona um programa nos filtros para visualizar as actividades."
          />
        ) : (
          <div className="act-scroll-box">
            <table className="act-table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col />
                <col style={{ width: '110px' }} />
                <col style={{ width: '150px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '110px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ minWidth: 300 }}>Designação</th>
                  <th className="act-th-c">Estado</th>
                  <th className="act-th-c">N.º Actividades</th>
                  <th className="act-th-c">Exec. real / prev.</th>
                  <th className="act-th-c">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="act-empty">
                      {searchQuery.trim()
                        ? `Nenhuma actividade encontrada para "${searchQuery}"`
                        : 'Nenhuma actividade para os filtros seleccionados.'}
                    </td>
                  </tr>
                ) : rows}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
