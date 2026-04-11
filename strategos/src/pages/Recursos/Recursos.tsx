import './Recursos.css'
import { useState, useMemo } from 'react'
import Card from '../../components/Card/Card'
import KpiCard from '../../components/KpiCard/KpiCard'
import Badge from '../../components/Badge/Badge'
import { useResources } from '../../hooks/useResources'
import { usePdsEntries } from '../../hooks/usePdsEntries'
import { useEixos } from '../../hooks/useEixos'
import { usePeople } from '../../hooks/usePeople'
import { useFilters } from '../../context/FilterContext'
import type { FteResource, PdsEntry, Person } from '../../types/index'

const WORKING_DAYS = 22

// ── Helpers ────────────────────────────────────────────────────
function fmtEur(v: number): string {
  return v.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

function fmtMo(ym: string): string {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1)
    .toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
}

function genMonths(start: string, end: string): string[] {
  if (start > end) return []
  const result: string[] = []
  let [y, m] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  while ((y < ey || (y === ey && m <= em)) && result.length < 120) {
    result.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return result
}

function activeInMonth(r: FteResource, mo: string): boolean {
  const s = r.start_date ? r.start_date.substring(0, 7) : null
  const e = r.end_date   ? r.end_date.substring(0, 7)   : null
  return (!s || s <= mo) && (!e || e >= mo)
}

function heatCls(pct: number): string {
  if (pct === 0) return ''
  if (pct > 100) return 'res-over'
  if (pct > 50)  return 'res-high'
  return 'res-low'
}

function typeLbl(type: string | null): string {
  return (type === 'externo' || type === 'external') ? 'Externo' : 'Interno'
}

function typeVar(type: string | null): 'blue' | 'grey' {
  return (type === 'externo' || type === 'external') ? 'blue' : 'grey'
}

function planLabel(entry: PdsEntry | undefined): string {
  if (!entry) return 'Plano desconhecido'
  return [entry.n0, entry.plan_name || entry.n1].filter(Boolean).join(' › ')
}

function planKey(entry: PdsEntry | undefined): string {
  return entry ? `${entry.n0}|${entry.n1}` : '__unknown__'
}

// ── Plan view ──────────────────────────────────────────────────
interface PlanViewProps {
  resources: FteResource[]
  entryMap: Map<string, PdsEntry>
  expanded: Set<string>
  onToggle: (key: string) => void
}

function PlanView({ resources, entryMap, expanded, onToggle }: PlanViewProps) {
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: FteResource[] }>()
    for (const r of resources) {
      const entry = entryMap.get(r.pds_id)
      const k     = planKey(entry)
      const lbl   = planLabel(entry)
      const grp   = map.get(k) ?? { label: lbl, items: [] }
      grp.items.push(r)
      map.set(k, grp)
    }
    return Array.from(map.entries()).map(([k, g]) => ({ key: k, ...g }))
  }, [resources, entryMap])

  if (groups.length === 0) return <p className="res-empty">Nenhum recurso alocado.</p>

  return (
    <table className="res-table">
      <thead>
        <tr>
          <th>Plano</th>
          <th className="res-th-c">Nº Recursos</th>
          <th className="res-th-c">FTE Total</th>
          <th className="res-th-r">Custo Mensal</th>
          <th className="res-th-c">Internos</th>
          <th className="res-th-c">Externos</th>
        </tr>
      </thead>
      <tbody>
        {groups.flatMap(g => {
          const isOpen  = expanded.has(g.key)
          const names   = new Set(g.items.map(r => r.name))
          const fte     = g.items.reduce((s, r) => s + (r.allocation_pct ?? 0) / 100, 0)
          const cost    = g.items.reduce((s, r) => s + (r.daily_cost ?? 0) * WORKING_DAYS * (r.allocation_pct ?? 0) / 100, 0)
          const intern  = g.items.filter(r => r.type === 'interno' || r.type === 'internal').length
          const ext     = g.items.filter(r => r.type === 'externo' || r.type === 'external').length

          const rows = [
            <tr key={`p-${g.key}`} className="res-plan-row" onClick={() => onToggle(g.key)}>
              <td className="res-plan-name">
                <span className="res-toggle-icon">{isOpen ? '▼' : '▶'}</span>
                {g.label}
              </td>
              <td className="res-td-c">{names.size}</td>
              <td className="res-td-c">{fte.toFixed(1)}</td>
              <td className="res-td-r">{fmtEur(cost)}</td>
              <td className="res-td-c">{intern}</td>
              <td className="res-td-c">{ext}</td>
            </tr>,
          ]

          if (isOpen) {
            rows.push(
              <tr key={`d-${g.key}`} className="res-detail-row">
                <td colSpan={6} className="res-detail-cell">
                  <table className="res-detail-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Perfil</th>
                        <th>Tipo</th>
                        <th className="res-th-c">Alocação</th>
                        <th className="res-th-r">Custo/dia</th>
                        <th>Período</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map(r => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{r.role ?? '—'}</td>
                          <td><Badge variant={typeVar(r.type)}>{typeLbl(r.type)}</Badge></td>
                          <td className="res-td-c">{r.allocation_pct ?? 0}%</td>
                          <td className="res-td-r">{r.daily_cost ? fmtEur(r.daily_cost) : '—'}</td>
                          <td>
                            {r.start_date?.substring(0, 7) ?? '—'}
                            {' — '}
                            {r.end_date?.substring(0, 7) ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            )
          }
          return rows
        })}
      </tbody>
    </table>
  )
}

// ── Resource heatmap ───────────────────────────────────────────
interface HeatmapProps {
  resources: FteResource[]
  months: string[]
  onSelect: (name: string) => void
}

function ResourceHeatmap({ resources, months, onSelect }: HeatmapProps) {
  const uniqueNames = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const r of resources) {
      if (!seen.has(r.name)) { seen.add(r.name); result.push(r.name) }
    }
    return result.sort()
  }, [resources])

  const allocMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of resources) {
      for (const mo of months) {
        if (activeInMonth(r, mo)) {
          const k = `${r.name}|${mo}`
          m.set(k, (m.get(k) ?? 0) + (r.allocation_pct ?? 0))
        }
      }
    }
    return m
  }, [resources, months])

  if (uniqueNames.length === 0) return <p className="res-empty">Nenhum recurso alocado.</p>
  if (months.length === 0) return <p className="res-empty">Período inválido.</p>

  return (
    <div className="res-heat-wrap">
      <table className="res-heat-table">
        <thead>
          <tr>
            <th className="res-heat-name-th">Recurso</th>
            {months.map(mo => <th key={mo} className="res-heat-mo-th">{fmtMo(mo)}</th>)}
          </tr>
        </thead>
        <tbody>
          {uniqueNames.map(name => (
            <tr key={name}>
              <td className="res-heat-name-td" onClick={() => onSelect(name)}>{name}</td>
              {months.map(mo => {
                const pct = allocMap.get(`${name}|${mo}`) ?? 0
                return (
                  <td key={mo} className={`res-heat-cell ${heatCls(pct)}`} title={pct > 0 ? `${pct}%` : ''}>
                    {pct > 0 ? pct : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="res-heat-legend">
        <span className="res-legend-item">
          <span className="res-legend-swatch res-low" />1–50%
        </span>
        <span className="res-legend-item">
          <span className="res-legend-swatch res-high" />51–100%
        </span>
        <span className="res-legend-item">
          <span className="res-legend-swatch res-over" />&gt;100% (sobrealoc.)
        </span>
      </div>
    </div>
  )
}

// ── Resource side panel ────────────────────────────────────────
interface ResourcePanelProps {
  name: string
  resources: FteResource[]
  entryMap: Map<string, PdsEntry>
  person: Person | undefined
  onClose: () => void
}

function ResourcePanel({ name, resources, entryMap, person, onClose }: ResourcePanelProps) {
  const myResources = useMemo(() => resources.filter(r => r.name === name), [resources, name])
  const first       = myResources[0]

  const planGroups = useMemo(() => {
    const map = new Map<string, { label: string; items: FteResource[] }>()
    for (const r of myResources) {
      const entry = entryMap.get(r.pds_id)
      const k     = planKey(entry)
      const lbl   = planLabel(entry)
      const grp   = map.get(k) ?? { label: lbl, items: [] }
      grp.items.push(r)
      map.set(k, grp)
    }
    return Array.from(map.values())
  }, [myResources, entryMap])

  return (
    <>
      <div className="res-panel-backdrop" onClick={onClose} />
      <div className="res-panel">
        <div className="res-panel-header">
          <span className="res-panel-title">{name}</span>
          <button className="res-panel-close" onClick={onClose} title="Fechar">✕</button>
        </div>

        <div className="res-panel-info">
          {first?.org_unit   && <div className="res-info-row"><span>Unidade</span>{first.org_unit}</div>}
          {first?.role       && <div className="res-info-row"><span>Perfil</span>{first.role}</div>}
          {first?.type       && (
            <div className="res-info-row">
              <span>Tipo</span>
              <Badge variant={typeVar(first.type)}>{typeLbl(first.type)}</Badge>
            </div>
          )}
          {first?.daily_cost && <div className="res-info-row"><span>Custo/dia</span>{fmtEur(first.daily_cost)}</div>}
          {person?.email     && <div className="res-info-row"><span>Email</span>{person.email}</div>}
        </div>

        <div className="res-panel-section-title">Alocações por plano</div>
        {planGroups.map((g, gi) => (
          <div key={gi} className="res-panel-plan">
            <div className="res-panel-plan-name">{g.label}</div>
            {g.items.map(r => (
              <div key={r.id} className="res-panel-plan-row">
                <span className="res-panel-alloc">{r.allocation_pct ?? 0}%</span>
                <span className="res-panel-dates">
                  {r.start_date?.substring(0, 7) ?? '?'} — {r.end_date?.substring(0, 7) ?? '?'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────
type ViewMode = 'plano' | 'recurso'

export default function Recursos() {
  const { filters } = useFilters()
  const programId   = filters.programIds[0]

  const { resources, loading } = useResources(programId)
  const { entries }            = usePdsEntries(programId)
  const { eixos }              = useEixos(programId)
  const { people }             = usePeople()

  const [view,          setView]          = useState<ViewMode>('plano')
  const [planKey_,      setPlanKey_]      = useState('')
  const [expandedPlans, setExpandedPlans] = useState(new Set<string>())
  const [selectedRes,   setSelectedRes]   = useState<string | null>(null)

  const [periodStart, setPeriodStart] = useState(() => `${new Date().getFullYear()}-01`)
  const [periodEnd,   setPeriodEnd]   = useState(() => `${new Date().getFullYear()}-12`)

  // ── PDS entry map ─────────────────────────────────────────────
  const entryMap = useMemo(() => {
    const m = new Map<string, PdsEntry>()
    for (const e of entries) m.set(e.id, e)
    return m
  }, [entries])

  // ── Plan selector options from eixos table ────────────────────
  const planOptions = useMemo(() =>
    eixos.map(eixo => ({ key: eixo.id, label: eixo.name })),
    [eixos]
  )

  // ── Selected eixo ─────────────────────────────────────────────
  const selectedEixo = useMemo(
    () => eixos.find(e => e.id === planKey_) ?? null,
    [eixos, planKey_]
  )

  // ── Entry IDs for selected eixo (null = all) ──────────────────
  const planIds = useMemo<Set<string> | null>(() => {
    if (!selectedEixo) return null
    return new Set(
      entries
        .filter(e => e.n1 === selectedEixo.name)
        .map(e => e.id)
    )
  }, [entries, selectedEixo])

  // ── Scoped resources ──────────────────────────────────────────
  const scoped = useMemo(
    () => planIds ? resources.filter(r => planIds.has(r.pds_id)) : resources,
    [resources, planIds]
  )

  // ── Months for heatmap ────────────────────────────────────────
  const months = useMemo(() => genMonths(periodStart, periodEnd), [periodStart, periodEnd])

  // ── Month selector options ────────────────────────────────────
  const allMonthOpts = useMemo(() => {
    const y = new Date().getFullYear()
    const opts: { value: string; label: string }[] = []
    for (let yr = y - 2; yr <= y + 3; yr++) {
      for (let mo = 1; mo <= 12; mo++) {
        const v = `${yr}-${String(mo).padStart(2, '0')}`
        opts.push({ value: v, label: fmtMo(v) })
      }
    }
    return opts
  }, [])

  // ── KPIs ──────────────────────────────────────────────────────
  const uniqueNames   = useMemo(() => new Set(scoped.map(r => r.name)), [scoped])
  const kpiFteMed     = scoped.length > 0
    ? scoped.reduce((s, r) => s + (r.allocation_pct ?? 0), 0) / scoped.length / 100
    : 0
  const kpiCusto      = scoped.reduce((s, r) => s + (r.daily_cost ?? 0) * WORKING_DAYS * (r.allocation_pct ?? 0) / 100, 0)
  const kpiInternos   = scoped.filter(r => r.type === 'interno' || r.type === 'internal').length
  const kpiExternos   = scoped.filter(r => r.type === 'externo' || r.type === 'external').length
  const kpiSobrealloc = scoped.filter(r => (r.allocation_pct ?? 0) > 100).length

  const total = kpiInternos + kpiExternos
  const iPct  = total > 0 ? Math.round(kpiInternos / total * 100) : 0
  const ePct  = total > 0 ? Math.round(kpiExternos / total * 100) : 0

  // ── Side panel data ───────────────────────────────────────────
  const selectedPerson = useMemo(
    () => selectedRes
      ? people.find(p => p.name.toLowerCase().trim() === selectedRes.toLowerCase().trim())
      : undefined,
    [selectedRes, people]
  )

  function togglePlan(key: string) {
    setExpandedPlans(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="res-page">

      {/* Controls bar: plan selector + period */}
      <div className="res-controls-bar">
        <span className="res-selector-label">Plano</span>
        <select
          className="res-selector-select res-plan-select"
          value={planKey_}
          onChange={e => setPlanKey_(e.target.value)}
        >
          <option value="">Todos os planos</option>
          {planOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>

        <div className="res-controls-sep" />

        <span className="res-selector-label">De</span>
        <select
          className="res-selector-select res-period-select"
          value={periodStart}
          onChange={e => setPeriodStart(e.target.value)}
        >
          {allMonthOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <span className="res-selector-label">Até</span>
        <select
          className="res-selector-select res-period-select"
          value={periodEnd}
          onChange={e => setPeriodEnd(e.target.value)}
        >
          {allMonthOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="res-empty-page">A carregar…</div>
      ) : resources.length === 0 ? (
        <div className="res-empty-page">Nenhum recurso alocado.</div>
      ) : (
        <>
          {/* KPI row */}
          <div className="res-kpi-row">
            <KpiCard label="Recursos únicos"     value={uniqueNames.size} color="navy" />
            <KpiCard label="FTE médio"            value={kpiFteMed.toFixed(2)} subtitle="por recurso" color="blue" />
            <KpiCard label="Custo mensal estim."  value={fmtEur(kpiCusto)} color="green" />
            <KpiCard
              label="Internos / Externos"
              value={`${kpiInternos} / ${kpiExternos}`}
              subtitle={`${iPct}% / ${ePct}%`}
              color="text"
            />
            <KpiCard
              label="Sobrealocações"
              value={kpiSobrealloc}
              subtitle="recursos > 100%"
              color={kpiSobrealloc > 0 ? 'red' : 'text'}
            />
          </div>

          {/* View toggle */}
          <div className="res-view-chips">
            <button
              className={`res-view-chip${view === 'plano' ? ' active' : ''}`}
              onClick={() => setView('plano')}
            >Vista por plano</button>
            <button
              className={`res-view-chip${view === 'recurso' ? ' active' : ''}`}
              onClick={() => setView('recurso')}
            >Vista por recurso</button>
          </div>

          {/* Main card */}
          <Card title={view === 'plano' ? 'Recursos por plano' : 'Mapa de alocação'}>
            {view === 'plano' ? (
              <PlanView
                resources={scoped}
                entryMap={entryMap}
                expanded={expandedPlans}
                onToggle={togglePlan}
              />
            ) : (
              <ResourceHeatmap
                resources={scoped}
                months={months}
                onSelect={setSelectedRes}
              />
            )}
          </Card>
        </>
      )}

      {/* Resource side panel */}
      {selectedRes && (
        <ResourcePanel
          name={selectedRes}
          resources={resources}
          entryMap={entryMap}
          person={selectedPerson}
          onClose={() => setSelectedRes(null)}
        />
      )}
    </div>
  )
}
