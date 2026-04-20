import './Recursos.css'
import { useState, useMemo, useEffect } from 'react'
import Spinner from '../../components/Spinner/Spinner'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import MultiSelect from '../../components/MultiSelect/MultiSelect'
import { useResources } from '../../hooks/useResources'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import { usePeople } from '../../hooks/usePeople'
import { useFilters } from '../../context/FilterContext'
import { supabase } from '../../lib/supabase'
import type { FteResource, Person } from '../../types/index'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

const WORKING_DAYS = 21

// ── Helpers ────────────────────────────────────────────────────
function fmtEur(v: number, sym = '€'): string {
  return v.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ' + sym
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

function isExternal(type: string | null): boolean {
  if (!type) return false
  const t = type.toLowerCase()
  return t === 'externo' || t === 'external'
}

function typeLbl(type: string | null): string {
  return isExternal(type) ? 'Externo' : 'Interno'
}

function typeVar(type: string | null): 'blue' | 'grey' {
  return isExternal(type) ? 'blue' : 'grey'
}

// ── Plan view ──────────────────────────────────────────────────
interface PlanViewProps {
  resources: FteResource[]
  planoNames: Map<string, string>
  expanded: Set<string>
  onToggle: (key: string) => void
  sym: string
}

function PlanView({ resources, planoNames, expanded, onToggle, sym }: PlanViewProps) {
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: FteResource[] }>()
    for (const r of resources) {
      const k   = r.pds_id || '__unknown__'
      const lbl = planoNames.get(r.pds_id) ?? 'Plano desconhecido'
      const grp = map.get(k) ?? { label: lbl, items: [] }
      grp.items.push(r)
      map.set(k, grp)
    }
    return Array.from(map.entries()).map(([k, g]) => ({ key: k, ...g }))
  }, [resources, planoNames])

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
          const intern  = g.items.filter(r => !isExternal(r.type)).length
          const ext     = g.items.filter(r => isExternal(r.type)).length

          const rows = [
            <tr key={`p-${g.key}`} className="res-plan-row" onClick={() => onToggle(g.key)}>
              <td className="res-plan-name">
                <span className="res-toggle-icon">{isOpen ? '▼' : '▶'}</span>
                {g.label}
              </td>
              <td className="res-td-c">{names.size}</td>
              <td className="res-td-c">{fte.toFixed(1)}</td>
              <td className="res-td-r">{fmtEur(cost, sym)}</td>
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
                          <td className="res-td-r">{r.daily_cost ? fmtEur(r.daily_cost, sym) : '—'}</td>
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
  planoNames: Map<string, string>
  person: Person | undefined
  onClose: () => void
  sym: string
}

function ResourcePanel({ name, resources, planoNames, person, onClose, sym }: ResourcePanelProps) {
  const myResources = useMemo(() => resources.filter(r => r.name === name), [resources, name])
  const first       = myResources[0]

  const planGroups = useMemo(() => {
    const map = new Map<string, { label: string; items: FteResource[] }>()
    for (const r of myResources) {
      const k   = r.pds_id || '__unknown__'
      const lbl = planoNames.get(r.pds_id) ?? 'Plano desconhecido'
      const grp = map.get(k) ?? { label: lbl, items: [] }
      grp.items.push(r)
      map.set(k, grp)
    }
    return Array.from(map.values())
  }, [myResources, planoNames])

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
          {first?.daily_cost && <div className="res-info-row"><span>Custo/dia</span>{fmtEur(first.daily_cost, sym)}</div>}
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

// ── Chart sub-components ───────────────────────────────────────
interface FtePoint { month: string; fte: number }

interface FteEvolutionChartProps { data: FtePoint[] }
function FteEvolutionChart({ data }: FteEvolutionChartProps) {
  if (data.length === 0)
    return <div className="rec-chart-empty">Sem dados no período</div>
  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border2)" />
        <XAxis dataKey="month" tickFormatter={fmtMo} tick={{ fontSize: 10 }} />
        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v: number) => [v.toFixed(2), 'FTE']}
          labelFormatter={fmtMo}
          contentStyle={{ fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="fte"
          stroke="var(--navy)"
          strokeWidth={2}
          dot={{ r: 3, fill: 'var(--navy)' }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface InternExtDonutProps {
  internos: number
  externos: number
  iPct: number
  ePct: number
  total: number
}
const DONUT_COLORS = ['var(--navy)', 'var(--blue)']
function InternExtDonut({ internos, externos, iPct, ePct, total }: InternExtDonutProps) {
  const pieData = [
    { name: 'Internos', value: internos },
    { name: 'Externos', value: externos },
  ]
  return (
    <div className="rec-donut-wrap">
      <div className="rec-donut-chart">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={76}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="rec-donut-center">
          <div className="rec-donut-total">{total}</div>
          <div className="rec-donut-label">total</div>
        </div>
      </div>
      <div className="rec-donut-legend">
        <div className="rec-donut-item">
          <span className="rec-donut-swatch" style={{ background: 'var(--navy)' }} />
          <span className="rec-donut-item-label">Internos</span>
          <span className="rec-donut-item-val">{internos} ({iPct}%)</span>
        </div>
        <div className="rec-donut-item">
          <span className="rec-donut-swatch" style={{ background: 'var(--blue)' }} />
          <span className="rec-donut-item-label">Externos</span>
          <span className="rec-donut-item-val">{externos} ({ePct}%)</span>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function Recursos() {
  const { filters }  = useFilters()
  const { programs } = usePrograms()

  const [selProgId,           setSelProgId]           = useState<string | null>(null)
  const [selectedPlanoLabels, setSelectedPlanoLabels] = useState<string[]>([])
  const [selectedYears,       setSelectedYears]       = useState<string[]>([])
  const [mgmtYears,           setMgmtYears]           = useState<string[]>([])
  const [activeTab,           setActiveTab]           = useState<'plano' | 'recurso' | 'lista'>('plano')
  const [expandedPlans,       setExpandedPlans]       = useState(new Set<string>())
  const [selectedRes,         setSelectedRes]         = useState<string | null>(null)
  const [currSymbol,          setCurrSymbol]          = useState('€')

  // Initialise selProgId from global filter or first program
  useEffect(() => {
    if (programs.length === 0) return
    setSelProgId(prev => {
      if (prev && programs.some(p => p.id === prev)) return prev
      return filters.programIds[0] ?? programs[0].id
    })
  }, [programs, filters.programIds])

  // Reset plano/year selection when program changes
  useEffect(() => {
    setSelectedPlanoLabels([])
    setSelectedYears([])
  }, [selProgId])

  // Fetch default currency symbol
  useEffect(() => {
    supabase.from('currencies').select('symbol').eq('is_default', true).limit(1)
      .then(({ data }) => { if (data?.[0]?.symbol) setCurrSymbol(data[0].symbol) })
  }, [])

  // Fetch management years for the selected program
  useEffect(() => {
    if (!selProgId) { setMgmtYears([]); return }
    let cancelled = false
    supabase
      .from('management_years')
      .select('year')
      .eq('program_id', selProgId)
      .order('year')
      .then(({ data }) => {
        if (cancelled) return
        setMgmtYears(data?.map(r => String(r.year)) ?? [])
      })
    return () => { cancelled = true }
  }, [selProgId])

  const programId = selProgId ?? undefined

  const { resources, loading } = useResources(programId)
  const { planos }             = usePlanos(programId)
  const { people }             = usePeople()

  // ── Plano options ─────────────────────────────────────────────
  const planoOptions = useMemo(() =>
    planos.map(p => p.eixo?.name ? `${p.eixo.name} > ${p.name}` : p.name),
    [planos]
  )

  const planoLabelToId = useMemo(() => {
    const m = new Map<string, string>()
    planos.forEach((p, i) => m.set(planoOptions[i], p.id))
    return m
  }, [planos, planoOptions])

  const selectedPlanoIds = useMemo(() =>
    selectedPlanoLabels.flatMap(l => {
      const id = planoLabelToId.get(l)
      return id ? [id] : []
    }),
    [selectedPlanoLabels, planoLabelToId]
  )

  // ── Year options ──────────────────────────────────────────────
  const yearOptions = useMemo(() => {
    if (mgmtYears.length > 0) return mgmtYears
    const years = new Set<string>()
    for (const r of resources) {
      if (r.start_date) years.add(r.start_date.substring(0, 4))
      if (r.end_date)   years.add(r.end_date.substring(0, 4))
    }
    return [...years].sort()
  }, [mgmtYears, resources])

  // ── Plano name map ────────────────────────────────────────────
  const planoNames = useMemo(
    () => new Map(planos.map(p => [p.id, p.eixo?.name ? `${p.eixo.name} > ${p.name}` : p.name])),
    [planos]
  )

  // ── Scoped resources (plano + year filtered) ──────────────────
  const scoped = useMemo(() => {
    let r = resources
    if (selectedPlanoIds.length > 0) {
      r = r.filter(res => selectedPlanoIds.includes(res.pds_id))
    }
    if (selectedYears.length > 0) {
      r = r.filter(res => selectedYears.some(y => {
        const yearStart = `${y}-01-01`
        const yearEnd   = `${y}-12-31`
        const s = res.start_date
        const e = res.end_date
        return (!s || s <= yearEnd) && (!e || e >= yearStart)
      }))
    }
    return r
  }, [resources, selectedPlanoIds, selectedYears])

  // ── Period (used by heatmap) ──────────────────────────────────
  const { periodStart, periodEnd } = useMemo(() => {
    if (selectedYears.length > 0) {
      const sorted = [...selectedYears].sort()
      return {
        periodStart: `${sorted[0]}-01`,
        periodEnd:   `${sorted[sorted.length - 1]}-12`,
      }
    }
    const dates = scoped
      .flatMap(r => [r.start_date, r.end_date])
      .filter((d): d is string => !!d)
      .map(d => d.substring(0, 7))
      .sort()
    if (dates.length > 0) return { periodStart: dates[0], periodEnd: dates[dates.length - 1] }
    const y = new Date().getFullYear()
    return { periodStart: `${y}-01`, periodEnd: `${y}-12` }
  }, [selectedYears, scoped])

  // ── Months for heatmap ────────────────────────────────────────
  const months = useMemo(() => genMonths(periodStart, periodEnd), [periodStart, periodEnd])

  // ── KPIs ─────────────────────────────────────────────────────
  // One entry per unique name — first record wins for type/dates
  const uniqueResources = useMemo(() => {
    const map = new Map<string, FteResource>()
    for (const r of scoped) {
      if (!map.has(r.name)) map.set(r.name, r)
    }
    return map
  }, [scoped])

  const kpiFteMed = useMemo(
    () => scoped.length > 0
      ? scoped.reduce((s, r) => s + (r.allocation_pct ?? 0), 0) / scoped.length / 100
      : 0,
    [scoped]
  )

  const kpiCusto = useMemo(() =>
    scoped.reduce((s, r) => {
      const activeMos = months.filter(mo => activeInMonth(r, mo)).length
      return s + (r.daily_cost ?? 0) * WORKING_DAYS * activeMos * (r.allocation_pct ?? 0) / 100
    }, 0),
    [scoped, months]
  )

  const kpiInternos = useMemo(
    () => Array.from(uniqueResources.values()).filter(r => !isExternal(r.type)).length,
    [uniqueResources]
  )
  const kpiExternos = useMemo(
    () => Array.from(uniqueResources.values()).filter(r =>  isExternal(r.type)).length,
    [uniqueResources]
  )

  // Fixed: sum allocations per name+month across all plans, count name+month > 100%
  const kpiSobrealloc = useMemo(() => {
    const allocMap = new Map<string, number>()
    for (const r of scoped) {
      for (const mo of months) {
        if (activeInMonth(r, mo)) {
          const k = `${r.name}|${mo}`
          allocMap.set(k, (allocMap.get(k) ?? 0) + (r.allocation_pct ?? 0))
        }
      }
    }
    let count = 0
    for (const total of allocMap.values()) { if (total > 100) count++ }
    return count
  }, [scoped, months])

  const kpiExpiring = useMemo(() => {
    const today    = new Date()
    const in30     = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    const todayStr = today.toISOString().substring(0, 10)
    const in30Str  = in30.toISOString().substring(0, 10)
    const seen = new Set<string>()
    for (const r of scoped) {
      if (r.end_date && r.end_date >= todayStr && r.end_date <= in30Str) seen.add(r.name)
    }
    return seen.size
  }, [scoped])

  const total = kpiInternos + kpiExternos
  const iPct  = total > 0 ? Math.round(kpiInternos / total * 100) : 0
  const ePct  = total > 0 ? Math.round(kpiExternos / total * 100) : 0
  const fmt   = (v: number) => fmtEur(v, currSymbol)

  const fteEvolutionData = useMemo<FtePoint[]>(() => {
    return months.map(mo => {
      const fte = scoped
        .filter(r => activeInMonth(r, mo))
        .reduce((s, r) => s + (r.allocation_pct ?? 0) / 100, 0)
      return { month: mo, fte: Math.round(fte * 100) / 100 }
    })
  }, [months, scoped])

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

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="rec-filter-bar">
        {/* Programa — zone 1 */}
        <div className="rec-filter-zone">
          <select
            className="styled-select"
            value={selProgId ?? ''}
            onChange={e => setSelProgId(e.target.value || null)}
          >
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Plano — zone 2 */}
        <div className="rec-filter-zone">
          <MultiSelect
            label="Plano"
            options={planoOptions}
            placeholder="Todos os planos"
            value={selectedPlanoLabels}
            onChange={setSelectedPlanoLabels}
          />
        </div>

        {/* Ano — zone 3 */}
        <div className="rec-filter-zone">
          <MultiSelect
            label="Ano"
            options={yearOptions}
            placeholder="Todos os anos"
            value={selectedYears}
            onChange={setSelectedYears}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Spinner />
        </div>
      ) : resources.length === 0 ? (
        <div className="res-empty-page">Nenhum recurso alocado.</div>
      ) : (
        <>
          {/* ── Row 1: Primary KPIs ──────────────────────────────── */}
          <div className="rec-kpi-row-primary">
            <div className="rec-kpi-card-primary">
              <div className="rec-kpi-label">Recursos únicos</div>
              <div className="rec-kpi-value-primary" style={{ color: 'var(--navy)' }}>
                {uniqueResources.size}
              </div>
            </div>

            <div className="rec-kpi-card-primary">
              <div className="rec-kpi-label">FTE médio</div>
              <div className="rec-kpi-value-primary" style={{ color: 'var(--blue)' }}>
                {kpiFteMed.toFixed(2)}
              </div>
              <div className="rec-kpi-sub">por recurso</div>
            </div>

            <div className="rec-kpi-card-primary">
              <div className="rec-kpi-label">Custo total</div>
              <div className="rec-kpi-value-primary" style={{ color: 'var(--navy)' }}>
                {fmt(kpiCusto)}
              </div>
              <div className="rec-kpi-sub">no período</div>
            </div>
          </div>

          {/* ── Row 2: Secondary KPIs ────────────────────────────── */}
          <div className="rec-kpi-row-secondary">
            <div className="rec-kpi-card-secondary">
              <div className="rec-kpi-label">Internos / Externos</div>
              <div className="rec-kpi-value-secondary" style={{ color: 'var(--text)' }}>
                {kpiInternos} / {kpiExternos}
              </div>
              <div className="rec-kpi-sub">{iPct}% / {ePct}%</div>
            </div>

            <div className="rec-kpi-card-secondary">
              <div className="rec-kpi-label">Sobrealocações</div>
              <div
                className="rec-kpi-value-secondary"
                style={{ color: kpiSobrealloc > 0 ? 'var(--red)' : 'var(--text3)' }}
              >
                {kpiSobrealloc}
              </div>
              <div className="rec-kpi-sub">recurso-mês &gt; 100%</div>
            </div>

            <div className="rec-kpi-card-secondary">
              <div className="rec-kpi-label">A terminar</div>
              <div
                className="rec-kpi-value-secondary"
                style={{ color: kpiExpiring > 0 ? 'var(--amber)' : 'var(--text3)' }}
              >
                {kpiExpiring}
              </div>
              <div className="rec-kpi-sub">nos próximos 30 dias</div>
            </div>
          </div>

          {/* ── Charts row ────────────────────────────────────────── */}
          <div className="rec-charts-row">
            <Card title="Evolução de FTE">
              <FteEvolutionChart data={fteEvolutionData} />
            </Card>
            <Card title="Internos vs Externos">
              <InternExtDonut
                internos={kpiInternos}
                externos={kpiExternos}
                iPct={iPct}
                ePct={ePct}
                total={total}
              />
            </Card>
          </div>

          {/* Main tabbed card */}
          <Card title="Recursos">
            <div className="rec-tabs">
              <button
                className={`rec-tab${activeTab === 'plano' ? ' active' : ''}`}
                onClick={() => setActiveTab('plano')}
              >Por Plano</button>
              <button
                className={`rec-tab${activeTab === 'recurso' ? ' active' : ''}`}
                onClick={() => setActiveTab('recurso')}
              >Por Recurso</button>
              <button
                className={`rec-tab${activeTab === 'lista' ? ' active' : ''}`}
                onClick={() => setActiveTab('lista')}
              >Lista Completa</button>
            </div>

            {activeTab === 'plano' && (
              <PlanView
                resources={scoped}
                planoNames={planoNames}
                expanded={expandedPlans}
                onToggle={togglePlan}
                sym={currSymbol}
              />
            )}
            {activeTab === 'recurso' && (
              <ResourceHeatmap
                resources={scoped}
                months={months}
                onSelect={setSelectedRes}
              />
            )}
            {activeTab === 'lista' && (
              <div className="rec-placeholder">
                <p>Lista completa de alocações — em desenvolvimento.</p>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Resource side panel */}
      {selectedRes && (
        <ResourcePanel
          name={selectedRes}
          resources={resources}
          planoNames={planoNames}
          person={selectedPerson}
          onClose={() => setSelectedRes(null)}
          sym={currSymbol}
        />
      )}
    </div>
  )
}
