import './Actividades.css'
import { useState, useMemo, useCallback } from 'react'
import Spinner from '../../components/Spinner/Spinner'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import KpiCard from '../../components/KpiCard/KpiCard'
import { useActivities } from '../../hooks/useActivities'
import { usePrograms } from '../../hooks/usePrograms'
import { useFilters } from '../../context/FilterContext'
import type { Activity, Program } from '../../types/index'
import { leafPctPrev, leafStatus } from '../../lib/rollup'

const TODAY = new Date().toISOString().slice(0, 10)

type BadgeVariant = 'green' | 'blue' | 'red' | 'amber' | 'grey' | 'navy'

// ── Status helpers ─────────────────────────────────────────────
type StatusCls = 'concluida' | 'em_dia' | 'em_atraso'

function actStatus(a: Activity): StatusCls {
  const s = leafStatus(a, TODAY)
  if (s === 'Concluída') return 'concluida'
  if (s === 'Em atraso') return 'em_atraso'
  return 'em_dia'
}

function groupStatus(concluidas: number, total: number, em_atraso: number): StatusCls {
  if (total > 0 && concluidas === total) return 'concluida'
  if (em_atraso > 0) return 'em_atraso'
  return 'em_dia'
}

const BADGE_VARIANT: Record<StatusCls, BadgeVariant> = {
  concluida:  'green',
  em_dia:     'blue',
  em_atraso:  'red',
}
const STATUS_LABEL: Record<StatusCls, string> = {
  concluida:  'Concluído',
  em_dia:     'Em dia',
  em_atraso:  'Em atraso',
}

// ── Stats computation ──────────────────────────────────────────
interface Stats {
  total: number
  concluidas: number
  em_dia: number
  em_atraso: number
  exec: number      // avg pct (0-100)
  exec_obj: number  // avg pct_prev (0-100)
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
      // Activities without n3 are merged into a pseudo n3 group with no header
      const noN3 = n3Map.get('') ?? []
      if (noN3.length > 0) {
        n3groups.push({ n3: '', acts: noN3 })
      }
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
  // Activities with no matching program_id
  const unmatched = progMap.get('')
  if (unmatched?.length) {
    groups.push({ progId: '', progName: '—', n1groups: buildTree(unmatched), allActs: unmatched })
  }
  return groups
}

// ── Sub-components ─────────────────────────────────────────────
function DualBar({ exec, execObj, statusCls }: { exec: number; execObj: number; statusCls: StatusCls }) {
  const r = Math.min(100, Math.max(0, exec))
  const p = Math.min(100, Math.max(0, execObj))
  const barClass = statusCls === 'em_atraso' ? 'red' : statusCls === 'concluida' ? 'green' : ''
  return (
    <div className="act-dualbar">
      <div className="act-dualbar-track">
        <div className="act-dualbar-prev" style={{ width: `${p}%` }} />
        <div className={`act-dualbar-real ${barClass}`} style={{ width: `${r}%` }} />
      </div>
      <span className="act-dualbar-label">
        {Math.round(r)}%<span>/{Math.round(p)}%</span>
      </span>
    </div>
  )
}

function DeadlineCell({ date }: { date: string | null }) {
  if (!date) return <td className="act-td-c act-deadline">—</td>
  const d = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const late = d < today
  const parts = date.split('-')
  const label = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date
  return <td className={`act-td-c act-deadline${late ? ' late' : ''}`}>{label}</td>
}

function CountsCell({ concluidas, em_dia, em_atraso }: { concluidas: number; em_dia: number; em_atraso: number }) {
  return (
    <td className="act-td-c act-counts">
      <span className="act-count-c">{concluidas}C</span>{' '}
      <span className="act-count-d">{em_dia}D</span>{' '}
      <span className="act-count-a">{em_atraso}A</span>
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

  // Collapse state: Set of node keys that are collapsed
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

  const rows: React.ReactNode[] = []

  // Inner helper — pushes N1/N2/N3/N4 rows into `rows`.
  // n1Indent: paddingLeft for N1; subsequent levels add 16px each.
  const renderN1Rows = (n1groups: N1Group[], n1Indent: number) => {
    for (const n1g of n1groups) {
      const n1key   = `n1:${n1g.n1}`
      const n1col   = collapsed.has(n1key)
      const n1stats = computeStats(n1g.allActs.filter(a => a.level === 4))
      const n1st    = groupStatus(n1stats.concluidas, n1stats.total, n1stats.em_atraso)

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
            <Badge variant={BADGE_VARIANT[n1st]}>{STATUS_LABEL[n1st]}</Badge>
          </td>
          <CountsCell {...n1stats} />
          <td className="act-td-c"><DualBar exec={n1stats.exec} execObj={n1stats.exec_obj} statusCls={n1st} /></td>
          <DeadlineCell date={n1stats.latest_end} />
        </tr>
      )

      if (n1col) continue

      for (const n2g of n1g.n2groups) {
        const n2key   = `n2:${n1g.n1}:${n2g.n2}`
        const n2col   = collapsed.has(n2key)
        const n2stats = computeStats(n2g.allActs.filter(a => a.level === 4))
        const n2st    = groupStatus(n2stats.concluidas, n2stats.total, n2stats.em_atraso)

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
              <Badge variant={BADGE_VARIANT[n2st]}>{STATUS_LABEL[n2st]}</Badge>
            </td>
            <CountsCell {...n2stats} />
            <td className="act-td-c"><DualBar exec={n2stats.exec} execObj={n2stats.exec_obj} statusCls={n2st} /></td>
            <DeadlineCell date={n2stats.latest_end} />
          </tr>
        )

        if (n2col) continue

        for (const n3g of n2g.n3groups) {
          // No n3 key — render all activities directly (no header)
          if (!n3g.n3) {
            for (const a of n3g.acts) {
              const ast  = actStatus(a)
              const aend = a.rf ?? a.bf ?? a.finish
              rows.push(
                <tr key={a.id} className="act-row-n4">
                  <td>
                    <div className="act-name-cell" style={{ paddingLeft: n1Indent + 32 }}>
                      <span className="act-name-n4" title={a.name}>{a.name}</span>
                    </div>
                  </td>
                  <td className="act-td-c">
                    <Badge variant={BADGE_VARIANT[ast]}>{STATUS_LABEL[ast]}</Badge>
                  </td>
                  <td className="act-td-c" />
                  <td className="act-td-c"><DualBar exec={a.pct} execObj={a.pct_prev} statusCls={ast} /></td>
                  <DeadlineCell date={aend ?? null} />
                </tr>
              )
            }
            continue
          }

          // Non-empty n3: check for real children (exclude the level-3 representative)
          const n3ChildLeaves = n3g.acts.filter(a => a.level !== 3)
          const n3HasChildren = n3ChildLeaves.length > 0

          if (!n3HasChildren) {
            // Macroactividade with no sub-activities — render as single leaf row, no header
            for (const a of n3g.acts) {
              const ast  = actStatus(a)
              const aend = a.rf ?? a.bf ?? a.finish
              rows.push(
                <tr key={a.id} className="act-row-n4">
                  <td>
                    <div className="act-name-cell" style={{ paddingLeft: n1Indent + 32 }}>
                      <span className="act-name-n4" title={a.name}>{a.name}</span>
                    </div>
                  </td>
                  <td className="act-td-c">
                    <Badge variant={BADGE_VARIANT[ast]}>{STATUS_LABEL[ast]}</Badge>
                  </td>
                  <td className="act-td-c" />
                  <td className="act-td-c"><DualBar exec={a.pct} execObj={a.pct_prev} statusCls={ast} /></td>
                  <DeadlineCell date={aend ?? null} />
                </tr>
              )
            }
            continue
          }

          // Has real children — render N3 header row
          const n3key   = `n3:${n1g.n1}:${n2g.n2}:${n3g.n3}`
          const n3col   = collapsed.has(n3key)
          const n3stats = computeStats(n3g.acts.filter(a => a.level === 4))
          const n3st    = groupStatus(n3stats.concluidas, n3stats.total, n3stats.em_atraso)

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
                <Badge variant={BADGE_VARIANT[n3st]}>{STATUS_LABEL[n3st]}</Badge>
              </td>
              <CountsCell {...n3stats} />
              <td className="act-td-c"><DualBar exec={n3stats.exec} execObj={n3stats.exec_obj} statusCls={n3st} /></td>
              <DeadlineCell date={n3stats.latest_end} />
            </tr>
          )

          if (n3col) continue

          // Render only non-representative children (representative excluded to avoid duplicate)
          for (const a of n3ChildLeaves) {
            const ast  = actStatus(a)
            const aend = a.rf ?? a.bf ?? a.finish
            rows.push(
              <tr key={a.id} className="act-row-n4">
                <td>
                  <div className="act-name-cell" style={{ paddingLeft: n1Indent + 48 }}>
                    <span className="act-name-n4" title={a.name}>{a.name}</span>
                  </div>
                </td>
                <td className="act-td-c">
                  <Badge variant={BADGE_VARIANT[ast]}>{STATUS_LABEL[ast]}</Badge>
                </td>
                <td className="act-td-c" />
                <td className="act-td-c"><DualBar exec={a.pct} execObj={a.pct_prev} statusCls={ast} /></td>
                <DeadlineCell date={aend ?? null} />
              </tr>
            )
          }
        }
      }
    }
  }

  if (n0tree) {
    // Multi-program: N0 group header + indented N1 subtree
    for (const n0g of n0tree) {
      const n0key   = `n0:${n0g.progId}`
      const n0col   = collapsed.has(n0key)
      const n0stats = computeStats(n0g.allActs.filter(a => a.level === 4))
      const n0st    = groupStatus(n0stats.concluidas, n0stats.total, n0stats.em_atraso)

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
            <Badge variant={BADGE_VARIANT[n0st]}>{STATUS_LABEL[n0st]}</Badge>
          </td>
          <CountsCell {...n0stats} />
          <td className="act-td-c"><DualBar exec={n0stats.exec} execObj={n0stats.exec_obj} statusCls={n0st} /></td>
          <DeadlineCell date={n0stats.latest_end} />
        </tr>
      )

      if (!n0col) renderN1Rows(n0g.n1groups, 16)
    }
  } else {
    // Single program (or no programs): existing behaviour, no N0 header
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {filterInfo && (
              <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>{filterInfo}</span>
            )}
            <button className="act-btn" onClick={collapseAll}>Colapsar tudo</button>
            <button className="act-btn" onClick={expandAll}>Expandir tudo</button>
          </div>
        }
      >
        {loading && activities.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Spinner />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="act-table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col />
                <col style={{ width: '90px' }} />
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
                      {filtered.length === 0 && activities.length === 0
                        ? 'Nenhuma actividade encontrada. Selecciona um programa para visualizar.'
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
