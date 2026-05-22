import './Recursos.css'
import { useState, useMemo, useEffect } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, ArrowUp, ArrowDown, X } from 'lucide-react'
import Spinner from '../../components/Spinner/Spinner'
import EmptyState from '../../components/EmptyState/EmptyState'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import MultiSelect from '../../components/MultiSelect/MultiSelect'
import { useResources } from '../../hooks/useResources'
import { usePlanos } from '../../hooks/usePlanos'
import { useAccessiblePrograms } from '../../hooks/useAccessiblePrograms'
import { usePeople } from '../../hooks/usePeople'
import { useFilters } from '../../context/FilterContext'
import { useProgramLabels } from '../../hooks/useProgramLabels'
import { usePermissions } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import type { FteResource, Person } from '../../types/index'
import { colors } from '../../lib/tokens'
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

function allocationColor(pct: number): { bg: string; color: string } {
  if (pct === 0)   return { bg: 'transparent',  color: 'var(--text3)' }
  if (pct <= 25)   return { bg: 'rgba(74, 124, 89, 0.15)', color: 'var(--text)'  }
  if (pct <= 50)   return { bg: 'rgba(74, 124, 89, 0.35)', color: 'var(--text)'  }
  if (pct <= 75)   return { bg: colors.status.ontrack,     color: 'white'        }
  if (pct <= 100)  return { bg: colors.brand.moss,         color: 'white'        }
  return                   { bg: colors.status.late,        color: 'white'        }
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

function personKey(r: FteResource): string {
  return r.person_id ? `pid:${r.person_id}` : `name:${r.name.toLowerCase().trim()}`
}

function monthsInRange(start: string | null, end: string | null): string[] {
  const today = new Date()
  const s = start ? start.substring(0, 7) : `${today.getFullYear() - 1}-01`
  const e = end   ? end.substring(0, 7)   : `${today.getFullYear() + 1}-12`
  return genMonths(s, e)
}

// ── Plan view ──────────────────────────────────────────────────
interface PlanViewProps {
  resources: FteResource[]
  planoNames: Map<string, string>
  expanded: Set<string>
  onToggle: (key: string) => void
  sym: string
  showCosts: boolean
}

function PlanView({ resources, planoNames, expanded, onToggle, sym, showCosts }: PlanViewProps) {
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
          {showCosts && <th className="res-th-r">Custo Mensal</th>}
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
                <span className="res-toggle-icon">{isOpen ? <ChevronDown size={14} strokeWidth={1.5} /> : <ChevronRight size={14} strokeWidth={1.5} />}</span>
                {g.label}
              </td>
              <td className="res-td-c">{names.size}</td>
              <td className="res-td-c">{fte.toFixed(1)}</td>
              {showCosts && <td className="res-td-r">{fmtEur(cost, sym)}</td>}
              <td className="res-td-c">{intern}</td>
              <td className="res-td-c">{ext}</td>
            </tr>,
          ]

          if (isOpen) {
            rows.push(
              <tr key={`d-${g.key}`} className="res-detail-row">
                <td colSpan={showCosts ? 6 : 5} className="res-detail-cell">
                  <table className="res-detail-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Perfil</th>
                        <th>Tipo</th>
                        <th className="res-th-c">Alocação</th>
                        {showCosts && <th className="res-th-r">Custo/dia</th>}
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
                          {showCosts && <td className="res-td-r">{r.daily_cost ? fmtEur(r.daily_cost, sym) : '—'}</td>}
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
interface HoverCell {
  resource: string
  month: string
  plans: Array<{ plan: string; allocation: number; daily_cost: number }>
  localPct: number
  globalPct: number
  otherProgramsAllocation: number
  x: number
  y: number
}

interface HeatmapProps {
  resources: FteResource[]
  globalAllocByPersonMonth: Map<string, Map<string, number>>
  months: string[]
  planoNames: Map<string, string>
  onSelect: (name: string) => void
  sym: string
  showCosts: boolean
}

function ResourceHeatmap({ resources, globalAllocByPersonMonth, months, planoNames, onSelect, sym, showCosts }: HeatmapProps) {
  const [hoverCell, setHoverCell] = useState<HoverCell | null>(null)

  const uniqueNames = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const r of resources) {
      if (!seen.has(r.name)) { seen.add(r.name); result.push(r.name) }
    }
    return result.sort()
  }, [resources])

  // Local allocation by name|month (within filtered scope)
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

  // First personKey for each display name (within scoped resources)
  const nameToPersonKey = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of resources) {
      if (!m.has(r.name)) m.set(r.name, personKey(r))
    }
    return m
  }, [resources])

  function getGlobalPct(name: string, mo: string): number {
    const pk = nameToPersonKey.get(name) ?? `name:${name.toLowerCase().trim()}`
    return Math.round(globalAllocByPersonMonth.get(pk)?.get(mo) ?? 0)
  }

  function buildHoverData(name: string, mo: string, x: number, y: number): HoverCell {
    const localPlans = resources
      .filter(r => r.name === name && activeInMonth(r, mo))
      .map(r => ({
        plan:       planoNames.get(r.pds_id) ?? 'Sem plano',
        allocation: r.allocation_pct ?? 0,
        daily_cost: r.daily_cost ?? 0,
      }))
    const localPct  = Math.round(allocMap.get(`${name}|${mo}`) ?? 0)
    const globalPct = getGlobalPct(name, mo)
    return {
      resource: name, month: mo,
      plans: localPlans,
      localPct, globalPct,
      otherProgramsAllocation: Math.max(0, globalPct - localPct),
      x, y,
    }
  }

  if (uniqueNames.length === 0) return <p className="res-empty">Nenhum recurso alocado.</p>
  if (months.length === 0) return <p className="res-empty">Período inválido.</p>

  return (
    <div className="res-heat-wrap">
      <table className="res-heat-table">
        <thead>
          <tr>
            <th className="res-heat-name-th">Recurso</th>
            {months.map(mo => <th key={mo} className="res-heat-mo-th">{fmtMo(mo)}</th>)}
            <th className="res-heat-mo-th rec-heat-total-th">Total</th>
          </tr>
        </thead>
        <tbody>
          {uniqueNames.map(name => {
            const rowTotal = months.reduce((s, mo) =>
              s + (allocMap.get(`${name}|${mo}`) ?? 0) / 100, 0)
            return (
              <tr key={name}>
                <td className="res-heat-name-td" onClick={() => onSelect(name)}>{name}</td>
                {months.map(mo => {
                  const localPct  = Math.round(allocMap.get(`${name}|${mo}`) ?? 0)
                  const globalPct = getGlobalPct(name, mo)
                  const { bg, color } = allocationColor(globalPct)
                  return (
                    <td
                      key={mo}
                      className="res-heat-cell"
                      style={{ background: bg, color }}
                      onMouseEnter={e => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const tw = 280, th = 180
                        let x = rect.right + 8
                        let y = rect.top
                        if (x + tw > window.innerWidth)  x = rect.left - tw - 8
                        if (y + th > window.innerHeight) y = rect.bottom - th
                        setHoverCell(buildHoverData(name, mo, x, y))
                      }}
                      onMouseLeave={() => setHoverCell(null)}
                    >
                      {localPct > 0 ? localPct : ''}
                    </td>
                  )
                })}
                <td className="res-heat-cell rec-heat-total-cell">
                  {rowTotal > 0 ? rowTotal.toFixed(1) : ''}
                </td>
              </tr>
            )
          })}

          {/* Totals row */}
          <tr className="rec-heat-totals-row">
            <td className="res-heat-name-td rec-heat-totals-label">Total</td>
            {months.map(mo => {
              const moTotal = uniqueNames.reduce(
                (s, name) => s + (allocMap.get(`${name}|${mo}`) ?? 0), 0)
              return (
                <td key={mo} className="res-heat-cell rec-heat-totals-cell">
                  {moTotal > 0 ? Math.round(moTotal) : ''}
                </td>
              )
            })}
            <td className="res-heat-cell rec-heat-total-cell" />
          </tr>
        </tbody>
      </table>

      <div className="rec-heatmap-legend">
        <span className="rec-legend-item">
          <span className="rec-legend-swatch" style={{ background: 'transparent', border: '1px solid var(--border)' }} />0%
        </span>
        <span className="rec-legend-item">
          <span className="rec-legend-swatch" style={{ background: 'rgba(74, 124, 89, 0.15)' }} />1-25%
        </span>
        <span className="rec-legend-item">
          <span className="rec-legend-swatch" style={{ background: 'rgba(74, 124, 89, 0.35)' }} />26-50%
        </span>
        <span className="rec-legend-item">
          <span className="rec-legend-swatch" style={{ background: colors.status.ontrack }} />51-75%
        </span>
        <span className="rec-legend-item">
          <span className="rec-legend-swatch" style={{ background: colors.brand.moss }} />76-100%
        </span>
        <span className="rec-legend-item">
          <span className="rec-legend-swatch" style={{ background: colors.status.late }} />&gt;100% (sobrealoc.)
        </span>
        <span className="rec-legend-global-hint">Cores baseadas em alocação global (todos os programas).</span>
      </div>

      {hoverCell && (
        <div className="rec-heatmap-tooltip" style={{ left: hoverCell.x, top: hoverCell.y }}>
          <div className="rec-tt-header">{hoverCell.resource} — {fmtMo(hoverCell.month)}</div>
          <div className="rec-tt-plans">
            {hoverCell.plans.length > 0 && (
              <div className="rec-tt-section-label">Neste programa:</div>
            )}
            {hoverCell.plans.map((p, i) => (
              <div key={i} className="rec-tt-plan-row">
                <span className="rec-tt-plan-name" title={p.plan}>{p.plan}</span>
                <span className="rec-tt-plan-info">
                  {p.allocation}%{showCosts && ` · ${fmtEur(p.daily_cost, sym)}/dia`}
                </span>
              </div>
            ))}
          </div>
          {hoverCell.otherProgramsAllocation > 0 && (
            <div className="rec-tt-other-programs">
              <div className="rec-tt-section-label">Outros programas:</div>
              <div style={{ fontSize: 12 }}>+{hoverCell.otherProgramsAllocation}% alocação</div>
            </div>
          )}
          <div className="rec-tt-total">
            Global: {hoverCell.globalPct}%
            {hoverCell.globalPct > 100 && (
              <span className="rec-tt-warning"> <AlertTriangle size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Sobrealocado</span>
            )}
          </div>
        </div>
      )}
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
  showCosts: boolean
}

function ResourcePanel({ name, resources, planoNames, person, onClose, sym, showCosts }: ResourcePanelProps) {
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
          <button className="res-panel-close" onClick={onClose} title="Fechar"><X size={16} strokeWidth={1.5} /></button>
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
          {showCosts && first?.daily_cost && <div className="res-info-row"><span>Custo/dia</span>{fmtEur(first.daily_cost, sym)}</div>}
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

// ── Lista completa ─────────────────────────────────────────────
type SortKey = 'name' | 'plan' | 'role' | 'type' | 'allocation' | 'daily_cost' | 'start' | 'end' | 'duration' | 'total_cost'

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, mo, day] = d.split('-')
  return `${day}/${mo}/${y}`
}

function computeDuration(r: FteResource): number {
  if (!r.start_date) return 0
  const start = new Date(r.start_date)
  const end   = r.end_date ? new Date(r.end_date) : new Date()
  return Math.max(0,
    (end.getFullYear() - start.getFullYear()) * 12
    + (end.getMonth() - start.getMonth()) + 1
  )
}

function formatDuration(months: number): string {
  if (months === 0) return '—'
  return `${months} ${months === 1 ? 'mês' : 'meses'}`
}

function computeTotalCost(r: FteResource): number {
  return computeDuration(r) * WORKING_DAYS * (r.daily_cost ?? 0) * (r.allocation_pct ?? 0) / 100
}

interface ListaCompletaProps {
  resources: FteResource[]
  planoNames: Map<string, string>
  sym: string
  showCosts: boolean
}

function ListaCompleta({ resources, planoNames, sym, showCosts }: ListaCompletaProps) {
  const [sortBy,  setSortBy]  = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(col: SortKey) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...resources].sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'name':       cmp = a.name.localeCompare(b.name); break
        case 'plan':       cmp = (planoNames.get(a.pds_id) ?? '').localeCompare(planoNames.get(b.pds_id) ?? ''); break
        case 'role':       cmp = (a.role ?? '').localeCompare(b.role ?? ''); break
        case 'type':       cmp = (a.type ?? '').localeCompare(b.type ?? ''); break
        case 'allocation': cmp = (a.allocation_pct ?? 0) - (b.allocation_pct ?? 0); break
        case 'daily_cost': cmp = (a.daily_cost ?? 0) - (b.daily_cost ?? 0); break
        case 'start':      cmp = (a.start_date ?? '').localeCompare(b.start_date ?? ''); break
        case 'end':        cmp = (a.end_date ?? '').localeCompare(b.end_date ?? ''); break
        case 'duration':   cmp = computeDuration(a) - computeDuration(b); break
        case 'total_cost': cmp = computeTotalCost(a) - computeTotalCost(b); break
      }
      return dir * cmp
    })
  }, [resources, planoNames, sortBy, sortDir])

  const totalAlloc   = sorted.reduce((s, r) => s + (r.allocation_pct ?? 0), 0)
  const totalCostSum = sorted.reduce((s, r) => s + computeTotalCost(r), 0)

  function th(col: SortKey, label: string, align?: 'num' | 'center') {
    const active = sortBy === col
    const cls    = ['sortable', align ?? ''].join(' ').trim()
    return (
      <th className={cls} onClick={() => handleSort(col)}>
        {label}
        {active && <span className="sort-arrow">{sortDir === 'asc' ? <ArrowUp size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} /> : <ArrowDown size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} />}</span>}
      </th>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="rec-lista-table">
        <colgroup>
          <col style={{ width: '10%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr>
            {th('name',       'Recurso')}
            {th('plan',       'Plano')}
            {th('role',       'Perfil')}
            {th('type',       'Tipo')}
            {th('allocation', 'Alocação',   'num')}
            {showCosts && th('daily_cost', 'Custo/dia',  'num')}
            {th('start',      'Início',     'center')}
            {th('end',        'Fim',        'center')}
            {th('duration',   'Duração',    'center')}
            {showCosts && th('total_cost', 'Custo total','num')}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={showCosts ? 10 : 8} className="rec-empty">Sem recursos para os filtros seleccionados.</td></tr>
          ) : (
            <>
              {sorted.map(r => {
                const planName = planoNames.get(r.pds_id) ?? 'Sem plano'
                const dur      = computeDuration(r)
                const cost     = computeTotalCost(r)
                return (
                  <tr key={r.id}>
                    <td title={r.name}>{r.name}</td>
                    <td title={planName}>{planName}</td>
                    <td>{r.role ?? '—'}</td>
                    <td><Badge variant={typeVar(r.type)}>{typeLbl(r.type)}</Badge></td>
                    <td className="num">{r.allocation_pct ?? 0}%</td>
                    {showCosts && <td className="num">{r.daily_cost ? fmtEur(r.daily_cost, sym) : '—'}</td>}
                    <td className="center">{fmtDate(r.start_date)}</td>
                    <td className="center">{fmtDate(r.end_date)}</td>
                    <td className="center">{formatDuration(dur)}</td>
                    {showCosts && <td className="num">{cost > 0 ? fmtEur(cost, sym) : '—'}</td>}
                  </tr>
                )
              })}
              <tr className="rec-lista-totals">
                <td colSpan={4} style={{ fontWeight: 700 }}>Total</td>
                <td className="num" style={{ fontWeight: 700 }}>{totalAlloc}%</td>
                {showCosts && <td />}
                <td /><td /><td />
                {showCosts && <td className="num" style={{ fontWeight: 700 }}>{fmtEur(totalCostSum, sym)}</td>}
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
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
          formatter={((v: number) => [v.toFixed(2), 'FTE']) as never}
          labelFormatter={fmtMo as never}
          contentStyle={{ fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="fte"
          stroke={colors.brand.ember}
          strokeWidth={2}
          dot={{ r: 3, fill: colors.brand.ember }}
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
const DONUT_COLORS = [colors.brand.ink700, colors.brand.ember]
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
          <span className="rec-donut-swatch" style={{ background: colors.brand.ink700 }} />
          <span className="rec-donut-item-label">Internos</span>
          <span className="rec-donut-item-val">{internos} ({iPct}%)</span>
        </div>
        <div className="rec-donut-item">
          <span className="rec-donut-swatch" style={{ background: colors.brand.ember }} />
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
  const programs = useAccessiblePrograms()
  const { canViewCosts, hasAccess } = usePermissions()

  const programId = filters.programIds[0] ?? programs[0]?.id
  const labels = useProgramLabels(programId ?? null)

  const [selectedYears,       setSelectedYears]       = useState<string[]>([])
  const [mgmtYears,           setMgmtYears]           = useState<string[]>([])
  const [activeTab,           setActiveTab]           = useState<'plano' | 'recurso' | 'lista'>('plano')
  const [expandedPlans,       setExpandedPlans]       = useState(new Set<string>())
  const [selectedRes,         setSelectedRes]         = useState<string | null>(null)
  const [currSymbol,          setCurrSymbol]          = useState('€')

  // Reset year selection when program changes
  useEffect(() => {
    setSelectedYears([])
  }, [programId])

  // Fetch default currency symbol
  useEffect(() => {
    supabase.from('currencies').select('symbol').eq('is_default', true).limit(1)
      .then(({ data }) => { if (data?.[0]?.symbol) setCurrSymbol(data[0].symbol) })
  }, [])

  // Fetch management years for the selected program
  useEffect(() => {
    if (!programId) { setMgmtYears([]); return }
    let cancelled = false
    supabase
      .from('management_years')
      .select('year')
      .eq('program_id', programId)
      .order('year')
      .then(({ data }) => {
        if (cancelled) return
        setMgmtYears(data?.map(r => String(r.year)) ?? [])
      })
    return () => { cancelled = true }
  }, [programId])
  const showCosts = canViewCosts('recursos', programId)

  const { resources, loading } = useResources(programId)

  // All resources across all programs — used for global allocation overlay
  const [allResources, setAllResources] = useState<FteResource[]>([])
  useEffect(() => {
    let cancelled = false
    supabase.from('fte_resources').select('*').then(({ data }) => {
      if (!cancelled) setAllResources((data ?? []) as FteResource[])
    })
    return () => { cancelled = true }
  }, [])
  const { planos }             = usePlanos(programId)
  const { people }             = usePeople()

  const accessiblePlanIds = useMemo(
    () => new Set(planos.filter(p => hasAccess('recursos', p.program_id ?? undefined, p.id)).map(p => p.id)),
    [planos, hasAccess],
  )
  const visiblePlanos = useMemo(
    () => planos.filter(p => accessiblePlanIds.has(p.id)),
    [planos, accessiblePlanIds],
  )
  const accessibleResources = useMemo(
    () => resources.filter(r => !r.pds_id || accessiblePlanIds.has(r.pds_id)),
    [resources, accessiblePlanIds],
  )

  // ── Breadcrumb + owner/sponsor plano scope ───────────────────
  const breadcrumbPlanoId = useMemo(() => {
    const n2Name = filters.n2Values[0] ?? null
    if (!n2Name) return null
    return visiblePlanos.find(p => p.name === n2Name)?.id ?? null
  }, [filters.n2Values, visiblePlanos])

  const ownerPlanoIds = useMemo(() => {
    if (filters.owners.length === 0) return null
    return new Set(
      visiblePlanos.filter(p => {
        const vals = (p.owner ?? '').split('|').map(s => s.trim()).filter(Boolean)
        return vals.some(v => filters.owners.includes(v))
      }).map(p => p.id)
    )
  }, [filters.owners, visiblePlanos])

  const sponsorPlanoIds = useMemo(() => {
    if (filters.sponsors.length === 0) return null
    return new Set(
      visiblePlanos.filter(p => {
        const vals = (p.sponsor ?? '').split('|').map(s => s.trim()).filter(Boolean)
        return vals.some(v => filters.sponsors.includes(v))
      }).map(p => p.id)
    )
  }, [filters.sponsors, visiblePlanos])

  // ── Year options ──────────────────────────────────────────────
  const yearOptions = useMemo(() => {
    if (mgmtYears.length > 0) return mgmtYears
    const years = new Set<string>()
    for (const r of accessibleResources) {
      if (r.start_date) years.add(r.start_date.substring(0, 4))
      if (r.end_date)   years.add(r.end_date.substring(0, 4))
    }
    return [...years].sort()
  }, [mgmtYears, resources])

  // ── Plano name map ────────────────────────────────────────────
  const planoNames = useMemo(
    () => new Map(visiblePlanos.map(p => [p.id, p.eixo?.name ? `${p.eixo.name} > ${p.name}` : p.name])),
    [visiblePlanos]
  )

  // ── Scoped resources (breadcrumb + owner/sponsor + year filtered) ─
  const scoped = useMemo(() => {
    let r = accessibleResources.filter(res =>
      (!breadcrumbPlanoId || res.pds_id === breadcrumbPlanoId) &&
      (!ownerPlanoIds     || (res.pds_id != null && ownerPlanoIds.has(res.pds_id))) &&
      (!sponsorPlanoIds   || (res.pds_id != null && sponsorPlanoIds.has(res.pds_id)))
    )
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
  }, [accessibleResources, breadcrumbPlanoId, ownerPlanoIds, sponsorPlanoIds, selectedYears])

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

  // ── Global allocation map (all programs) ─────────────────────
  const globalAllocByPersonMonth = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const r of allResources) {
      const pk = personKey(r)
      if (!map.has(pk)) map.set(pk, new Map())
      const pm = map.get(pk)!
      for (const mo of monthsInRange(r.start_date, r.end_date)) {
        pm.set(mo, (pm.get(mo) ?? 0) + (r.allocation_pct ?? 0))
      }
    }
    return map
  }, [allResources])

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

  // Count person-months in scoped view that are over-allocated GLOBALLY
  const kpiSobrealloc = useMemo(() => {
    const seen = new Set<string>()
    let count = 0
    for (const r of scoped) {
      const pk = personKey(r)
      for (const mo of months) {
        if (!activeInMonth(r, mo)) continue
        const key = `${pk}|${mo}`
        if (seen.has(key)) continue
        seen.add(key)
        const globalPct = globalAllocByPersonMonth.get(pk)?.get(mo) ?? 0
        if (globalPct > 100) count++
      }
    }
    return count
  }, [scoped, months, globalAllocByPersonMonth])

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
        <EmptyState
          icon="data"
          title="Sem recursos alocados"
          description="Não existem recursos alocados para os filtros seleccionados."
        />
      ) : (
        <>
          {/* ── Row 1: Primary KPIs ──────────────────────────────── */}
          <div className="rec-kpi-row-primary">
            <div className="rec-kpi-card-primary">
              <div className="rec-kpi-label t-label">Recursos únicos</div>
              <div className="rec-kpi-value-primary t-headline-sm t-tabular" style={{ color: 'var(--navy)' }}>
                {uniqueResources.size}
              </div>
            </div>

            <div className="rec-kpi-card-primary">
              <div className="rec-kpi-label t-label">FTE médio</div>
              <div className="rec-kpi-value-primary t-headline-sm t-tabular" style={{ color: 'var(--blue)' }}>
                {kpiFteMed.toFixed(2)}
              </div>
              <div className="rec-kpi-sub">por recurso</div>
            </div>

            <div className="rec-kpi-card-primary">
              <div className="rec-kpi-label t-label">Custo total</div>
              <div className="rec-kpi-value-primary t-headline-sm t-tabular" style={{ color: 'var(--navy)' }}>
                {fmt(kpiCusto)}
              </div>
              <div className="rec-kpi-sub">no período</div>
            </div>
          </div>

          {/* ── Row 2: Secondary KPIs ────────────────────────────── */}
          <div className="rec-kpi-row-secondary">
            <div className="rec-kpi-card-secondary">
              <div className="rec-kpi-label t-label">Internos / Externos</div>
              <div className="rec-kpi-value-secondary" style={{ color: 'var(--text)' }}>
                {kpiInternos} / {kpiExternos}
              </div>
              <div className="rec-kpi-sub">{iPct}% / {ePct}%</div>
            </div>

            <div className="rec-kpi-card-secondary">
              <div className="rec-kpi-label t-label">Sobrealocações</div>
              <div
                className="rec-kpi-value-secondary"
                style={{ color: kpiSobrealloc > 0 ? 'var(--red)' : 'var(--text3)' }}
              >
                {kpiSobrealloc}
              </div>
              <div className="rec-kpi-sub">recurso-mês &gt; 100% (global)</div>
            </div>

            <div className="rec-kpi-card-secondary">
              <div className="rec-kpi-label t-label">A terminar</div>
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
              >Por {labels.n2}</button>
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
                showCosts={showCosts}
              />
            )}
            {activeTab === 'recurso' && (
              <ResourceHeatmap
                resources={scoped}
                globalAllocByPersonMonth={globalAllocByPersonMonth}
                months={months}
                planoNames={planoNames}
                onSelect={setSelectedRes}
                sym={currSymbol}
                showCosts={showCosts}
              />
            )}
            {activeTab === 'lista' && (
              <ListaCompleta
                resources={scoped}
                planoNames={planoNames}
                sym={currSymbol}
                showCosts={showCosts}
              />
            )}
          </Card>
        </>
      )}

      {/* Resource side panel */}
      {selectedRes && (
        <ResourcePanel
          name={selectedRes}
          resources={accessibleResources}
          planoNames={planoNames}
          person={selectedPerson}
          onClose={() => setSelectedRes(null)}
          sym={currSymbol}
          showCosts={showCosts}
        />
      )}
    </div>
  )
}
