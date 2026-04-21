import './Actividades.css'
import { useState, useMemo, useCallback } from 'react'
import Spinner from '../../components/Spinner/Spinner'
import Card from '../../components/Card/Card'
import KpiCard from '../../components/KpiCard/KpiCard'
import EmptyState from '../../components/EmptyState/EmptyState'
import { useActivities } from '../../hooks/useActivities'
import { usePrograms } from '../../hooks/usePrograms'
import { useFilters } from '../../context/FilterContext'
import type { Activity, Program } from '../../types/index'
import { leafPctPrev, leafStatus, computeRowState, type RowState } from '../../lib/rollup'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Status helpers ─────────────────────────────────────────────
type StatusCls = 'concluida' | 'em_dia' | 'em_atraso'
type LevelView  = 'todos' | 'programa' | 'eixo' | 'plano' | 'macro' | 'actividade'

function actStatus(a: Activity): StatusCls {
  const s = leafStatus(a, TODAY)
  if (s === 'Concluída') return 'concluida'
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
  em_atraso: number
  exec: number
  exec_obj: number
  latest_end: string | null
}

function computeStats(acts: Activity[]): Stats {
  const total = acts.length
  let concluidas = 0, em_dia = 0, em_atraso = 0, sumPct = 0, sumPrev = 0
  let latest_end: string | null = null
  for (const a of acts) {
    const s = actStatus(a)
    if (s === 'concluida') concluidas++
    else if (s === 'em_dia') em_dia++
    else em_atraso++
    sumPct  += a.pct
    sumPrev += leafPctPrev(a, TODAY)
    const end = a.rf ?? a.bf
    if (end && (!latest_end || end > latest_end)) latest_end = end
  }
  return {
    total, concluidas, em_dia, em_atraso,
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

function CdaCell({ concluidas, em_dia, em_atraso }: { concluidas: number; em_dia: number; em_atraso: number }) {
  return (
    <td className="act-td-c act-cda">
      <span className="act-cda-item act-cda-c">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5.5" cy="5.5" r="4.5"/>
          <path d="M3.5 5.5L5 7l3-3"/>
        </svg>
        {concluidas}
      </span>
      <span className="act-cda-item act-cda-d">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5.5" cy="5.5" r="4.5"/>
          <path d="M5.5 3.5v2.2l1.5 1"/>
        </svg>
        {em_dia}
      </span>
      <span className="act-cda-item act-cda-a">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.5 1.5L10 9.5H1z"/>
          <line x1="5.5" y1="4.5" x2="5.5" y2="6.5"/>
          <circle cx="5.5" cy="7.8" r="0.4" fill="currentColor" stroke="none"/>
        </svg>
        {em_atraso}
      </span>
    </td>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function Actividades() {
  const { filters, getFilteredActivities } = useFilters()
  const { activities, loading } = useActivities({
    program_id: filters.programIds[0],
    cutoffDate: filters.cutoffDate,
  })
  const { programs } = usePrograms()
  const multiProg = programs.length > 1

  const filtered = useMemo(() => getFilteredActivities(activities), [activities, getFilteredActivities])
  const tree     = useMemo(() => buildTree(filtered), [filtered])
  const n0tree   = useMemo(
    () => multiProg ? buildProgramTree(filtered, programs) : null,
    [filtered, programs, multiProg]
  )
  const summary  = useMemo(() => computeStats(filtered.filter(a => a.level === 4)), [filtered])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

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

  const rows: React.ReactNode[] = []

  const renderN1Rows = (n1groups: N1Group[], n1Indent: number) => {
    for (const n1g of n1groups) {
      const n1key    = `n1:${n1g.n1}`
      const n1col    = collapsed.has(n1key)
      const n1leaves = n1g.allActs.filter(a => a.level === 4)
      const n1stats  = computeStats(n1leaves)
      const n1state  = computeRowState(n1stats.exec, n1stats.exec_obj)

      rows.push(
        <tr key={n1key} className="act-row-n1">
          <td>
            <div className="act-name-cell" style={{ paddingLeft: n1Indent }}>
              <button className="act-toggle" onClick={() => toggle(n1key)}>
                {n1col ? '▶' : '▼'}
              </button>
              <span className="act-name-n1">{n1g.n1}</span>
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
        const n2stats  = computeStats(n2leaves)
        const n2state  = computeRowState(n2stats.exec, n2stats.exec_obj)

        rows.push(
          <tr key={n2key} className="act-row-n2">
            <td>
              <div className="act-name-cell" style={{ paddingLeft: n1Indent + 16 }}>
                <button className="act-toggle" onClick={() => toggle(n2key)}>
                  {n2col ? '▶' : '▼'}
                </button>
                <span className="act-name-n2">{n2g.n2}</span>
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
              const ast     = computeRowState(a.pct, pctPrev)
              rows.push(
                <tr key={a.id} className="act-row-n4">
                  <td>
                    <div className="act-name-cell" style={{ paddingLeft: n1Indent + 32 }}>
                      <span className="act-name-n4" title={a.name}>{a.name}</span>
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
              const ast     = computeRowState(a.pct, pctPrev)
              rows.push(
                <tr key={a.id} className="act-row-n4">
                  <td>
                    <div className="act-name-cell" style={{ paddingLeft: n1Indent + 32 }}>
                      <span className="act-name-n4" title={a.name}>{a.name}</span>
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
          const n3stats  = computeStats(n3leaves)
          const n3state  = computeRowState(n3stats.exec, n3stats.exec_obj)

          rows.push(
            <tr key={n3key} className="act-row-n3">
              <td>
                <div className="act-name-cell" style={{ paddingLeft: n1Indent + 32 }}>
                  <button className="act-toggle" onClick={() => toggle(n3key)}>
                    {n3col ? '▶' : '▼'}
                  </button>
                  <span className="act-name-n3">{n3g.n3}</span>
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
            const ast     = computeRowState(a.pct, pctPrev)
            rows.push(
              <tr key={a.id} className="act-row-n4">
                <td>
                  <div className="act-name-cell" style={{ paddingLeft: n1Indent + 48 }}>
                    <span className="act-name-n4" title={a.name}>{a.name}</span>
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
                {n0col ? '▶' : '▼'}
              </button>
              <span className="act-name-n0">{n0g.progName}</span>
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

      <Card
        title="Actividades"
        actions={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {filterInfo && (
              <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>{filterInfo}</span>
            )}
            <button className="act-btn" onClick={collapseAll}>Colapsar tudo</button>
            <button className="act-btn" onClick={expandAll}>Expandir tudo</button>
            <span className="act-sep" />
            <button className={`act-chip${levelView === 'todos' ? ' active' : ''}`} onClick={() => applyLevel('todos')}>Todos</button>
            {multiProg && (
              <button className={`act-chip${levelView === 'programa' ? ' active' : ''}`} onClick={() => applyLevel('programa')}>Programa</button>
            )}
            <button className={`act-chip${levelView === 'eixo' ? ' active' : ''}`} onClick={() => applyLevel('eixo')}>Eixo</button>
            <button className={`act-chip${levelView === 'plano' ? ' active' : ''}`} onClick={() => applyLevel('plano')}>Plano</button>
            <button className={`act-chip${levelView === 'macro' ? ' active' : ''}`} onClick={() => applyLevel('macro')}>Macroactividade</button>
            <button className={`act-chip${levelView === 'actividade' ? ' active' : ''}`} onClick={() => applyLevel('actividade')}>Actividade</button>
          </div>
        }
      >
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
          <div style={{ overflowX: 'auto' }}>
            <table className="act-table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col />
                <col style={{ width: '110px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '110px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ minWidth: 300 }}>Designação</th>
                  <th className="act-th-c">Estado</th>
                  <th className="act-th-c">C / D / A</th>
                  <th className="act-th-c">Exec. real / prev.</th>
                  <th className="act-th-c">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="act-empty">
                      Nenhuma actividade para os filtros seleccionados.
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
