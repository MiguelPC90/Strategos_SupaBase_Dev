import './Gantt.css'
import { useState, useMemo, useCallback } from 'react'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import { useActivities } from '../../hooks/useActivities'
import { useFilters } from '../../context/FilterContext'
import type { Activity } from '../../types/index'

// ── Types ──────────────────────────────────────────────────────
type StatusCls    = 'concluida' | 'em_dia' | 'em_atraso'
type BadgeVariant = 'green' | 'blue' | 'red' | 'amber' | 'grey' | 'navy'
type Scale        = 'Semana' | 'Mês' | 'Trimestre'

const SCALES: Scale[] = ['Semana', 'Mês', 'Trimestre']
const COL_WIDTH: Record<Scale, number> = { Semana: 40, Mês: 60, Trimestre: 100 }
const COL_NAME   = 280
const COL_STATUS = 80
const COL_EXEC   = 60
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ── Status helpers ─────────────────────────────────────────────
function actStatus(a: Activity): StatusCls {
  if (a.pct >= 100 || a.status === 'Concluído') return 'concluida'
  if (a.status === 'Em dia') return 'em_dia'
  return 'em_atraso'
}

function groupStatus(acts: Activity[]): StatusCls {
  const total      = acts.length
  const concluidas = acts.filter(a => actStatus(a) === 'concluida').length
  const em_atraso  = acts.filter(a => actStatus(a) === 'em_atraso').length
  if (total > 0 && concluidas === total) return 'concluida'
  if (em_atraso > 0) return 'em_atraso'
  return 'em_dia'
}

const BADGE_VARIANT: Record<StatusCls, BadgeVariant> = {
  concluida: 'green', em_dia: 'blue', em_atraso: 'red',
}
const STATUS_LABEL: Record<StatusCls, string> = {
  concluida: 'Concluído', em_dia: 'Em dia', em_atraso: 'Em atraso',
}

// ── Tree types ─────────────────────────────────────────────────
interface N3Group { n3: string; acts: Activity[] }
interface N2Group { n2: string; n3groups: N3Group[]; allActs: Activity[] }
interface N1Group { n1: string; n2groups: N2Group[]; allActs: Activity[] }

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

function groupAvgPct(acts: Activity[]): number {
  if (acts.length === 0) return 0
  return Math.round(acts.reduce((s, a) => s + a.pct, 0) / acts.length)
}

function fmt(d: string | null): string {
  if (!d) return '—'
  const p = d.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

// ── Tooltip data ───────────────────────────────────────────────
interface TooltipState {
  name: string
  bs: string | null; bf: string | null
  rs: string | null; rf: string | null
  pct: number; status: string
  x: number; y: number
}

// ── Bar sub-component ──────────────────────────────────────────
interface BarProps {
  start: string | null; end: string | null
  rangeStart: Date; totalMs: number
  variant: 'baseline' | 'real'
  lane: 'top' | 'bottom'
  status: StatusCls
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
    bg = status === 'concluida' ? 'var(--green)' : status === 'em_atraso' ? 'var(--red)' : 'var(--navy)'
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

  const filtered = useMemo(() => getFilteredActivities(activities), [activities, getFilteredActivities])
  const tree     = useMemo(() => buildTree(filtered), [filtered])

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
    for (const n1g of tree) {
      keys.add(`n1:${n1g.n1}`)
      for (const n2g of n1g.n2groups) {
        keys.add(`n2:${n1g.n1}:${n2g.n2}`)
        for (const n3g of n2g.n3groups) {
          if (n3g.n3) keys.add(`n3:${n1g.n1}:${n2g.n2}:${n3g.n3}`)
        }
      }
    }
    setCollapsed(keys)
  }, [tree])

  const expandAll = useCallback(() => setCollapsed(new Set()), [])

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
    status: StatusCls,
    act: Activity | null,
  ): JSX.Element {
    const handlers = act ? {
      onMouseEnter: (e: React.MouseEvent) => setTooltip({
        name: act.name, bs: act.bs, bf: act.bf, rs: act.rs, rf: act.rf,
        pct: act.pct, status: act.status, x: e.clientX, y: e.clientY,
      }),
      onMouseMove:  (e: React.MouseEvent) => setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null),
      onMouseLeave: () => setTooltip(null),
    } : {}

    return (
      <td
        key="tl"
        className={`gantt-tl-td${act ? ' gantt-tl-hoverable' : ''}`}
        style={{ width: timelineW, minWidth: timelineW }}
        colSpan={nPeriodCols}
        {...handlers}
      >
        {/* Period grid lines */}
        {periods.map((_, i) => i > 0 && (
          <div key={i} className="gantt-grid-line" style={{ left: `${(i / periods.length) * 100}%` }} />
        ))}
        {/* Fix 6: Today marker with "Hoje" label */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div className="gantt-today-line" style={{ left: `${todayPct}%` }}>
            <span className="gantt-today-label">Hoje</span>
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

  for (const n1g of tree) {
    const n1key = `n1:${n1g.n1}`
    const n1col = collapsed.has(n1key)
    const n1st  = groupStatus(n1g.allActs)
    const n1dr  = groupDateRange(n1g.allActs)

    rows.push(
      <tr key={n1key} className="gantt-row-n1">
        <td className="gantt-name-td gantt-sticky-1" style={{ left: 0 }}>
          <div className="gantt-name-cell" style={{ paddingLeft: 4 }}>
            <button className="gantt-toggle" onClick={() => toggle(n1key)}>{n1col ? '▶' : '▼'}</button>
            <span className="gantt-name-n1" title={n1g.n1}>{n1g.n1}</span>
          </div>
        </td>
        <td className="gantt-meta-td gantt-sticky-2" style={{ left: COL_NAME }}>
          <Badge variant={BADGE_VARIANT[n1st]}>{STATUS_LABEL[n1st]}</Badge>
        </td>
        <td className="gantt-meta-td gantt-sticky-3" style={{ left: COL_NAME + COL_STATUS }}>{groupAvgPct(n1g.allActs)}%</td>
        {makeTimeline(n1dr.bs, n1dr.bf, n1dr.rs, n1dr.rf, n1st, null)}
        <td className="gantt-filler-td" />
      </tr>
    )
    if (n1col) continue

    for (const n2g of n1g.n2groups) {
      const n2key = `n2:${n1g.n1}:${n2g.n2}`
      const n2col = collapsed.has(n2key)
      const n2st  = groupStatus(n2g.allActs)
      const n2dr  = groupDateRange(n2g.allActs)

      rows.push(
        <tr key={n2key} className="gantt-row-n2">
          <td className="gantt-name-td gantt-sticky-1" style={{ left: 0 }}>
            <div className="gantt-name-cell" style={{ paddingLeft: 20 }}>
              <button className="gantt-toggle" onClick={() => toggle(n2key)}>{n2col ? '▶' : '▼'}</button>
              <span className="gantt-name-n2" title={n2g.n2}>{n2g.n2}</span>
            </div>
          </td>
          <td className="gantt-meta-td gantt-sticky-2" style={{ left: COL_NAME }}>
            <Badge variant={BADGE_VARIANT[n2st]}>{STATUS_LABEL[n2st]}</Badge>
          </td>
          <td className="gantt-meta-td gantt-sticky-3" style={{ left: COL_NAME + COL_STATUS }}>{groupAvgPct(n2g.allActs)}%</td>
          {makeTimeline(n2dr.bs, n2dr.bf, n2dr.rs, n2dr.rf, n2st, null)}
          <td className="gantt-filler-td" />
        </tr>
      )
      if (n2col) continue

      for (const n3g of n2g.n3groups) {
        if (n3g.n3) {
          const n3key = `n3:${n1g.n1}:${n2g.n2}:${n3g.n3}`
          const n3col = collapsed.has(n3key)
          const n3st  = groupStatus(n3g.acts)
          const n3dr  = groupDateRange(n3g.acts)

          rows.push(
            <tr key={n3key} className="gantt-row-n3">
              <td className="gantt-name-td gantt-sticky-1" style={{ left: 0 }}>
                <div className="gantt-name-cell" style={{ paddingLeft: 36 }}>
                  <button className="gantt-toggle" onClick={() => toggle(n3key)}>{n3col ? '▶' : '▼'}</button>
                  <span className="gantt-name-n3" title={n3g.n3}>{n3g.n3}</span>
                </div>
              </td>
              <td className="gantt-meta-td gantt-sticky-2" style={{ left: COL_NAME }}>
                <Badge variant={BADGE_VARIANT[n3st]}>{STATUS_LABEL[n3st]}</Badge>
              </td>
              <td className="gantt-meta-td gantt-sticky-3" style={{ left: COL_NAME + COL_STATUS }}>{groupAvgPct(n3g.acts)}%</td>
              {makeTimeline(n3dr.bs, n3dr.bf, n3dr.rs, n3dr.rf, n3st, null)}
              <td className="gantt-filler-td" />
            </tr>
          )
          if (n3col) continue
        }

        for (const a of n3g.acts) {
          const ast = actStatus(a)
          rows.push(
            <tr key={a.id} className="gantt-row-n4">
              <td className="gantt-name-td gantt-sticky-1" style={{ left: 0 }}>
                <div className="gantt-name-cell" style={{ paddingLeft: n3g.n3 ? 52 : 36 }}>
                  <span className="gantt-name-n4" title={a.name}>{a.name}</span>
                </div>
              </td>
              <td className="gantt-meta-td gantt-sticky-2" style={{ left: COL_NAME }}>
                <Badge variant={BADGE_VARIANT[ast]}>{STATUS_LABEL[ast]}</Badge>
              </td>
              <td className="gantt-meta-td gantt-sticky-3" style={{ left: COL_NAME + COL_STATUS }}>{a.pct}%</td>
              {makeTimeline(a.bs, a.bf, a.rs, a.rf, ast, a)}
              <td className="gantt-filler-td" />
            </tr>
          )
        }
      }
    }
  }

  return (
    <>
      <Card title="GANTT">
        {/* Fix 1: Toolbar with navy background, inside card body bleeding edge-to-edge */}
        <div className="gantt-toolbar">
          <div className="gantt-legend">
            <span className="gantt-legend-item">
              <span className="gantt-legend-swatch gantt-swatch-baseline" />Baseline
            </span>
            <span className="gantt-legend-item">
              <span className="gantt-legend-swatch gantt-swatch-real" />Real
            </span>
          </div>
          <div className="gantt-scale-chips">
            {SCALES.map(s => (
              <button
                key={s}
                className={`gantt-scale-chip${scale === s ? ' active' : ''}`}
                onClick={() => setScale(s)}
              >{s}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button className="gantt-toolbar-btn" onClick={collapseAll}>Colapsar</button>
            <button className="gantt-toolbar-btn" onClick={expandAll}>Expandir</button>
          </div>
        </div>

        {loading ? (
          <div className="gantt-empty">A carregar…</div>
        ) : filtered.length === 0 ? (
          <div className="gantt-empty">
            {activities.length === 0
              ? 'Sem actividades carregadas. Selecciona um programa nos filtros.'
              : 'Sem actividades para os filtros seleccionados.'}
          </div>
        ) : (
          <div className="gantt-scroll-wrap">
            <table
              className="gantt-table"
              style={{ tableLayout: 'fixed' }}
            >
              <colgroup>
                <col style={{ width: COL_NAME }} />
                <col style={{ width: COL_STATUS }} />
                <col style={{ width: COL_EXEC }} />
                {periods.map((_, i) => <col key={i} style={{ width: colW }} />)}
                <col style={{ width: 60 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="gantt-th gantt-sticky-1" style={{ left: 0 }}>Designação</th>
                  <th className="gantt-th gantt-sticky-2" style={{ left: COL_NAME, textAlign: 'center' }}>Estado</th>
                  <th className="gantt-th gantt-sticky-3" style={{ left: COL_NAME + COL_STATUS, textAlign: 'center' }}>Exec.</th>
                  {periods.map((p, i) => (
                    <th key={i} className="gantt-th gantt-th-period">{p.label}</th>
                  ))}
                  {/* Issue 4: filler header — empty, navy bg extends to right edge */}
                  <th className="gantt-th gantt-th-filler" />
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        )}
      </Card>

      {tooltip && (
        <div className="gantt-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 8 }}>
          <div className="gantt-tt-name">{tooltip.name}</div>
          <div className="gantt-tt-row"><span>Baseline:</span>{fmt(tooltip.bs)} → {fmt(tooltip.bf)}</div>
          <div className="gantt-tt-row"><span>Real:</span>{fmt(tooltip.rs)} → {fmt(tooltip.rf)}</div>
          <div className="gantt-tt-row"><span>Execução:</span>{tooltip.pct}%</div>
          <div className="gantt-tt-row"><span>Estado:</span>{tooltip.status}</div>
        </div>
      )}
    </>
  )
}
