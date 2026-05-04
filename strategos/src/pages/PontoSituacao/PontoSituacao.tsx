import './PontoSituacao.css'
import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import Spinner from '../../components/Spinner/Spinner'
import EmptyState from '../../components/EmptyState/EmptyState'
import Card from '../../components/Card/Card'
import KpiCard from '../../components/KpiCard/KpiCard'
import Badge from '../../components/Badge/Badge'
import { usePdsEntries, usePdsConsolidated } from '../../hooks/usePdsEntries'
import { usePlanos } from '../../hooks/usePlanos'
import { useAccessiblePrograms } from '../../hooks/useAccessiblePrograms'
import { useRisks } from '../../hooks/useRisks'
import { useActivities } from '../../hooks/useActivities'
import { useFilters } from '../../context/FilterContext'

import { leafStatus, leafPctPrev } from '../../lib/rollup'
import { supabase } from '../../lib/supabase'
import type { PdsItem, Risk } from '../../types/index'
import { gradeStyle, gradeLabel, DEFAULT_THRESHOLDS, type RiskThresholds } from '../../lib/riskColors'
import {
  computeHealth, DEFAULT_HEALTH_CONFIG,
  type HealthConfig, type HealthInput,
} from '../../lib/healthRules'

const TODAY = new Date().toISOString().slice(0, 10)

type SortDir = 'asc' | 'desc'
function sortItems(items: PdsItem[], dir: SortDir): PdsItem[] {
  if (!items.some(i => i.created_at)) return items
  return [...items].sort((a, b) => {
    const cmp = (a.created_at ?? '').localeCompare(b.created_at ?? '')
    return dir === 'asc' ? cmp : -cmp
  })
}

function SortBtn({ dir, onToggle }: { dir: SortDir; onToggle: () => void }) {
  return (
    <button
      className="pds-sort-btn"
      onClick={onToggle}
      title={dir === 'asc' ? 'Ordenar: mais recente primeiro' : 'Ordenar: mais antigo primeiro'}
    >
      {dir === 'asc' ? '↑' : '↓'}
    </button>
  )
}

// ── Date formatter — always dd/mm/yyyy ────────────────────────
function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// ── Item status → Badge variant ──────────────────────────────
type BadgeVariant = 'green' | 'blue' | 'red' | 'amber' | 'grey' | 'navy'
function statusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase()
  if (s === 'concluído' || s === 'concluída') return 'green'
  if (s === 'em curso') return 'blue'
  if (s === 'em atraso') return 'red'
  return 'grey'
}

// ── Display status: auto-override to 'Em atraso' when date is past ──
function displayStatus(item: PdsItem): string | null {
  if (!item.status) return null
  const s = item.status.toLowerCase()
  if (s !== 'concluído' && s !== 'concluída' && item.date && item.date < TODAY) {
    return 'Em atraso'
  }
  return item.status
}

// ── Text renderer: **bold** + newlines via CSS pre-wrap ────────
function renderText(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>
  )
}

// ── PDS item list ──────────────────────────────────────────────
type ItemListVariant = 'default' | 'attention' | 'progress'

interface ItemListProps {
  items: PdsItem[]
  variant?: ItemListVariant
  emptyMessage?: string
  showMeta?: boolean
}

function ItemList({ items, variant = 'default', emptyMessage = 'Sem itens.', showMeta }: ItemListProps) {
  if (items.length === 0) {
    return <p className="pds-empty">{emptyMessage}</p>
  }

  // Plain-text fallback for progress + attention: all items lack date AND status
  if ((variant === 'progress' || variant === 'attention') && items.every(item => !item.date && !item.status)) {
    return (
      <div className="pds-progress-wrap">
        {items.map((item, i) => (
          <p key={i} className="pds-progress-para">
            {renderText(item.text)}
            {showMeta && item.created_at && (
              <span className="pds-item-created">
                {item.author ? `${item.author} · ` : ''}{fmtDate(item.created_at.slice(0, 10))}
              </span>
            )}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="pds-item-rows">
      <div className="pds-item-header">
        <span className="pds-item-header-label col-item">Item</span>
        <span className="pds-item-header-label col-date">Data</span>
        <span className="pds-item-header-label col-status">Estado</span>
      </div>
      {items.map((item, i) => {
        const ds = displayStatus(item)
        return (
          <div
            key={i}
            className={`pds-item-row${variant === 'attention' ? ' pds-attention-row' : ''}`}
          >
            <span className="pds-item-text">
              {renderText(item.text)}
              {showMeta && item.created_at && (
                <span className="pds-item-created">
                  {item.author ? `${item.author} · ` : ''}{fmtDate(item.created_at.slice(0, 10))}
                </span>
              )}
            </span>
            <span className="pds-col-date">{item.date ? fmtDate(item.date) : '—'}</span>
            <span className="pds-item-badge">
              {ds && <Badge variant={statusVariant(ds)}>{ds}</Badge>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Risk helpers ────────────────────────────────────────────────
type RiskBadge = 'green' | 'amber' | 'red' | 'grey'

function estadoVariant(status: string): RiskBadge {
  const s = status.toLowerCase()
  if (s === 'aberto')       return 'red'
  if (s === 'em mitigação') return 'amber'
  if (s === 'mitigado')     return 'grey'
  if (s === 'fechado')      return 'green'
  return 'grey'
}

// ── Risk matrix component ─────────────────────────────────────
interface RiskMatrixProps {
  risks: Risk[]
  size: number
  thresholds: RiskThresholds
  selectedIds: string[]
  onSelect: (ids: string[]) => void
}

function RiskMatrix({ risks, size, thresholds, selectedIds, onSelect }: RiskMatrixProps) {
  const cellMap = useMemo(() => {
    const map = new Map<string, Risk[]>()
    for (const r of risks) {
      const k = `${r.impact},${r.probability}`
      map.set(k, [...(map.get(k) ?? []), r])
    }
    return map
  }, [risks])

  const cells: ReactNode[] = []
  const yNums: ReactNode[] = []

  for (let prob = size; prob >= 1; prob--) {
    yNums.push(<span key={`y${prob}`} className="pds-risk-axis-num">{prob}</span>)
    for (let impact = 1; impact <= size; impact++) {
      const grade = impact * prob
      const gs    = gradeStyle(grade, size, thresholds)
      const k     = `${impact},${prob}`
      const cellRisks = cellMap.get(k) ?? []
      const sel   = cellRisks.some(r => selectedIds.includes(r.id))
      cells.push(
        <div
          key={`c${impact}${prob}`}
          className={`pds-risk-cell${cellRisks.length ? ' has-risks' : ''}${sel ? ' selected' : ''}`}
          style={{ background: gs.bg, border: `1px solid ${gs.border}` }}
          onClick={() => onSelect(cellRisks.length ? cellRisks.map(r => r.id) : [])}
          title={cellRisks.map(r => r.description).join('\n')}
        >
          {cellRisks.length > 0 && (
            <span className={`pds-risk-dot${sel ? ' selected' : ''}`}>
              {cellRisks.length > 1 ? String(cellRisks.length) : ''}
            </span>
          )}
        </div>
      )
    }
  }

  const gridCols = `repeat(${size}, 1fr)`

  return (
    <div className="pds-risk-matrix-wrap">
      <div className="pds-risk-matrix-label">Matriz de Risco</div>
      <div className="pds-risk-matrix-body">
        <span className="pds-risk-axis-label pds-risk-axis-y">PROBABILIDADE</span>
        <div className="pds-risk-matrix-right">
          <div className="pds-risk-matrix-row">
            <div className="pds-risk-y-col">{yNums}</div>
            <div className="pds-risk-matrix" style={{ gridTemplateColumns: gridCols, gridTemplateRows: gridCols }}>
              {cells}
            </div>
          </div>
          <div className="pds-risk-x-row">
            <div className="pds-risk-x-spacer" />
            <div className="pds-risk-x-nums" style={{ gridTemplateColumns: gridCols }}>
              {Array.from({ length: size }, (_, i) => (
                <span key={i} className="pds-risk-axis-num pds-risk-axis-x">{i + 1}</span>
              ))}
            </div>
          </div>
          <span className="pds-risk-axis-label pds-risk-axis-bottom">IMPACTO</span>
        </div>
      </div>
    </div>
  )
}

// ── Risk table component ──────────────────────────────────────
interface RiskTableProps {
  risks: Risk[]
  size: number
  thresholds: RiskThresholds
  selectedIds: string[]
  onSelect: (ids: string[]) => void
}

function RiskTable({ risks, size, thresholds, selectedIds, onSelect }: RiskTableProps) {
  return (
    <div className="pds-risk-table-wrap">
      <div className="pds-risk-table-header">
        <span>Descrição</span>
        <span className="pds-tc">Impacto</span>
        <span className="pds-tc">Prob.</span>
        <span className="pds-tc">Grau</span>
        <span className="pds-tc">Estado</span>
        <span>Mitigação</span>
      </div>
      {risks.map(r => {
        const grade = r.impact * r.probability
        const gs    = gradeStyle(grade, size, thresholds)
        const sel   = selectedIds.includes(r.id)
        return (
          <div
            key={r.id}
            className={`pds-risk-table-row${sel ? ' selected' : ''}`}
            onClick={() => onSelect([r.id])}
          >
            <span>{r.description}</span>
            <span className="pds-tc">{r.impact}</span>
            <span className="pds-tc">{r.probability}</span>
            <span className="pds-tc">
              <span className="pds-risk-grade" style={{ background: gs.bg, color: gs.color }} title={gradeLabel(grade, size, thresholds)}>
                {grade}
              </span>
            </span>
            <span className="pds-tc">
              <Badge variant={estadoVariant(r.status)}>{r.status}</Badge>
            </span>
            <span className="pds-risk-mitigation" title={r.mitigation}>{r.mitigation}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function PontoSituacao() {
  const { filters }   = useFilters()
  const programs = useAccessiblePrograms()
  // ── State ──────────────────────────────────────────────────
  const [selectedKey,       setSelectedKey]       = useState('')
  const [hideCompletedDays, setHideCompletedDays] = useState(90)
  const [selectedRiskIds,   setSelectedRiskIds]   = useState<string[]>([])
  const [matrixSize,        setMatrixSize]        = useState(5)
  const [thresholds,        setThresholds]        = useState<RiskThresholds>(DEFAULT_THRESHOLDS)
  const [healthConfig,      setHealthConfig]      = useState<HealthConfig>(DEFAULT_HEALTH_CONFIG)
  const [commitSort,        setCommitSort]        = useState<SortDir>('asc')
  const [progressSort,      setProgressSort]      = useState<SortDir>('asc')
  const [nextSort,          setNextSort]          = useState<SortDir>('asc')
  const [attnSort,          setAttnSort]          = useState<SortDir>('asc')

  // ── Data hooks ─────────────────────────────────────────────
  const programId = filters.programIds[0] ?? programs[0]?.id
  const { entries, loading: entriesLoading } = usePdsEntries(programId)
  const { items: consolidated, loading: consLoading } = usePdsConsolidated(selectedKey || undefined)
  const loading = entriesLoading || consLoading
  const { planos }           = usePlanos(programId)
  const { risks }            = useRisks(programId)
  const { activities }       = useActivities({ program_id: programId })

  // ── Effects ────────────────────────────────────────────────

  // Reset plan selection when program changes
  useEffect(() => {
    setSelectedKey('')
  }, [programId])

  // Reset risk selection when plan changes
  useEffect(() => {
    setSelectedRiskIds([])
  }, [selectedKey])

  // Load app_config values once
  useEffect(() => {
    supabase.from('app_config').select('data').eq('config_key', 'pds_hide_completed_days').single()
      .then(({ data }) => {
        if (data != null) {
          const v = parseInt(data.data ?? '')
          if (!isNaN(v)) setHideCompletedDays(v)
        }
      })
    supabase.from('app_config').select('config_key, data')
      .in('config_key', ['risk_matrix_size', 'risk_thresholds', 'health_rules'])
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, string> = {}
        for (const row of data) map[row.config_key] = row.data
        if (map['risk_matrix_size']) {
          const v = parseInt(map['risk_matrix_size'])
          if (!isNaN(v) && v >= 2 && v <= 8) setMatrixSize(v)
        }
        if (map['risk_thresholds']) {
          try { setThresholds({ ...DEFAULT_THRESHOLDS, ...JSON.parse(map['risk_thresholds']) }) }
          catch { /* keep defaults */ }
        }
        if (map['health_rules']) {
          try { setHealthConfig({ ...DEFAULT_HEALTH_CONFIG, ...JSON.parse(map['health_rules']) }) }
          catch { /* keep defaults */ }
        }
      })
  }, [])

  // ── Derived data ───────────────────────────────────────────

  const planOptions = useMemo(() =>
    planos.map(p => ({ key: p.id, label: p.name })),
    [planos]
  )

  const selectedPlano = useMemo(
    () => planos.find(p => p.id === selectedKey) ?? null,
    [planos, selectedKey]
  )

  const selectedProgram = useMemo(
    () => programs.find(p => p.id === programId) ?? null,
    [programs, programId]
  )

  const psThresholdLeaves = useMemo(
    () => selectedPlano?.threshold_leaves ?? selectedProgram?.threshold_leaves ?? 0,
    [selectedPlano, selectedProgram]
  )

  const planEntries = useMemo(() => {
    if (!selectedPlano) return []
    return entries
      .filter(e =>
        e.plan_name === selectedPlano.name &&
        (!selectedPlano.eixo || e.n1 === selectedPlano.eixo.name)
      )
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [entries, selectedPlano])

  const planRisks = useMemo(() => {
    if (!selectedKey) return []
    return risks.filter(r => r.plano_id === selectedKey)
  }, [risks, selectedKey])

  // N4+ leaf activities for KPIs, filtered by plano_id
  const planLeaves = useMemo(() => {
    if (!selectedKey) return []
    return activities.filter(a => a.plano_id === selectedKey && a.level >= 4)
  }, [activities, selectedKey])

  const planLabel = planOptions.find(o => o.key === selectedKey)?.label ?? ''

  // ── Consolidated visible items per section ─────────────────
  const visCommitments = useMemo(
    () => consolidated.commitments.filter(i => !i.hidden_at),
    [consolidated.commitments],
  )
  const visProgress = useMemo(
    () => consolidated.progress.filter(i => !i.hidden_at),
    [consolidated.progress],
  )
  const visNextSteps = useMemo(
    () => consolidated.nextSteps.filter(i => !i.hidden_at),
    [consolidated.nextSteps],
  )
  const visAttention = useMemo(
    () => consolidated.attention.filter(i => !i.hidden_at),
    [consolidated.attention],
  )

  // ── KPI computations ───────────────────────────────────────
  const kpi = useMemo(() => {
    const total      = planLeaves.length
    const statuses   = planLeaves.map(a => leafStatus(a, TODAY, psThresholdLeaves))
    const concluidas = statuses.filter(s => s === 'Concluída').length
    const emDia      = statuses.filter(s => s === 'Em dia').length
    const emRisco    = statuses.filter(s => s === 'Em risco').length
    const emAtraso   = statuses.filter(s => s === 'Em atraso').length
    const pct        = total > 0 ? Math.round(planLeaves.reduce((s, a) => s + a.pct, 0) / total) : 0
    const pctPrev    = total > 0 ? Math.round(planLeaves.reduce((s, a) => s + leafPctPrev(a, TODAY), 0) / total) : 0
    const geralReal  = total > 0 ? Math.round((concluidas / total) * 100) : 0
    const geralObj   = total > 0 ? Math.round(((concluidas + emAtraso) / total) * 100) : 0
    const aDataReal  = (concluidas + emAtraso) > 0
      ? Math.round((concluidas / (concluidas + emAtraso)) * 100)
      : 0
    return { total, concluidas, emDia, emRisco, emAtraso, pct, pctPrev, geralReal, geralObj, aDataReal }
  }, [planLeaves, psThresholdLeaves])

  // ── Plan navigation ────────────────────────────────────────
  const planosInProgram = planos  // already sorted by sort_order from hook
  const currentIdx = useMemo(
    () => planosInProgram.findIndex(p => p.id === selectedKey),
    [planosInProgram, selectedKey],
  )
  const goPrev = useCallback(() => {
    if (currentIdx > 0) setSelectedKey(planosInProgram[currentIdx - 1].id)
  }, [currentIdx, planosInProgram])
  const goNext = useCallback(() => {
    if (currentIdx < planosInProgram.length - 1) setSelectedKey(planosInProgram[currentIdx + 1].id)
  }, [currentIdx, planosInProgram])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev() }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext])

  // ── Health indicator ───────────────────────────────────────
  const healthInput = useMemo((): HealthInput => {
    const total     = planLeaves.length
    const delayed   = planLeaves.filter(a => {
      const s = leafStatus(a, TODAY, psThresholdLeaves)
      return s === 'Em atraso' || s === 'Em risco'
    }).length
    const avgPct    = total > 0 ? planLeaves.reduce((s, a) => s + a.pct, 0) / total : 0
    const avgPrev   = total > 0 ? planLeaves.reduce((s, a) => s + leafPctPrev(a, TODAY), 0) / total : 0
    const attOpen   = visAttention.filter(i => {
      const s = (i.status ?? '').toLowerCase()
      return s !== 'concluído' && s !== 'concluída'
    }).length
    return {
      execDelay:     Math.max(0, avgPrev - avgPct),
      delayedPct:    total > 0 ? (delayed / total) * 100 : 0,
      criticalRisks: planRisks.filter(r => r.impact * r.probability > thresholds.high).length,
      highRisks:     planRisks.filter(r => {
        const g = r.impact * r.probability
        return g > thresholds.medium && g <= thresholds.high
      }).length,
      attentionOpen: attOpen,
    }
  }, [planLeaves, psThresholdLeaves, planRisks, visAttention, thresholds])

  const health = useMemo(
    () => computeHealth(healthInput, healthConfig),
    [healthInput, healthConfig],
  )

  // ── Risk KPIs ──────────────────────────────────────────────
  const riskKpis = useMemo(() => ({
    total:     planRisks.length,
    critical:  planRisks.filter(r => r.impact * r.probability > thresholds.high).length,
    open:      planRisks.filter(r => {
      const s = r.status.toLowerCase()
      return s !== 'fechado' && s !== 'mitigado'
    }).length,
    mitigated: planRisks.filter(r => {
      const s = r.status.toLowerCase()
      return s === 'fechado' || s === 'mitigado'
    }).length,
  }), [planRisks, thresholds])

  // ── Filter old completed commitments ──────────────────────
  const { visibleCommitments, hiddenCommitmentsCount } = useMemo(() => {
    if (hideCompletedDays <= 0) return { visibleCommitments: visCommitments, hiddenCommitmentsCount: 0 }
    const cutoff = new Date(TODAY)
    cutoff.setDate(cutoff.getDate() - hideCompletedDays)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const hidden = visCommitments.filter(item =>
      (item.status === 'Concluído' || item.status === 'Concluída') &&
      item.date && item.date < cutoffStr
    )
    return {
      visibleCommitments:     visCommitments.filter(i => !hidden.includes(i)),
      hiddenCommitmentsCount: hidden.length,
    }
  }, [visCommitments, hideCompletedDays])

  // ── Risk selection handler ────────────────────────────────
  const handleSelectRisk = (ids: string[]) => {
    setSelectedRiskIds(prev => {
      const same = prev.length === ids.length && ids.every(id => prev.includes(id))
      return same ? [] : ids
    })
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="pds-page">

      {/* Plan selector bar */}
      <div className="pds-selector-bar">
        <span className="pds-selector-label">Plano</span>
        <select
          className="styled-select"
          value={selectedKey}
          onChange={e => setSelectedKey(e.target.value)}
        >
          <option value="">— Seleccionar plano —</option>
          {planOptions.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Empty / no-selection states */}
      {!loading && planOptions.length === 0 ? (
        <EmptyState
          icon="folder"
          title="Sem planos disponíveis"
          description="Não existem planos de acção disponíveis para este programa."
        />
      ) : !selectedKey ? (
        <div className="pds-placeholder">
          Seleccione um plano para ver o ponto de situação.
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Spinner />
        </div>
      ) : (
        <>
          {/* Header — 3-zone: left (health + name), center (nav), right (date) */}
          <div className="pds-header">
            <div className="pds-header-left">
              <span
                className={`pds-health pds-health-${health.level}`}
                title={health.reasons.join('\n')}
              />
              <span className="pds-plan-name">{planLabel}</span>
            </div>
            <div className="pds-header-nav">
              <button
                className="pds-nav-btn"
                onClick={goPrev}
                disabled={currentIdx <= 0}
                title="Plano anterior (Alt+←)"
              >←</button>
              <button
                className="pds-nav-btn"
                onClick={goNext}
                disabled={currentIdx >= planosInProgram.length - 1}
                title="Plano seguinte (Alt+→)"
              >→</button>
            </div>
            <span className="pds-header-date">{fmtDate(planEntries[0]?.updated_at ?? TODAY)}</span>
          </div>

          {/* KPI cards — 3-card top row */}
          <div className="pds-kpi-grid">
            <Card title="Dados Gerais">
              <div className="kpi-2col">
                <KpiCard label="Total actividades" value={kpi.total} />
                <KpiCard label="Concluídas" value={kpi.concluidas} color="green" />
                <KpiCard label="Em dia"     value={kpi.emDia}      color="blue" />
                <KpiCard label="Em risco"   value={kpi.emRisco}    color="amber" />
                <KpiCard label="Em atraso"  value={kpi.emAtraso}   color="red" />
              </div>
            </Card>

            <Card title="Indicadores de Concretização">
              <div className="ind-section">
                <div className="ind-section-header">
                  <span className="ind-dot" style={{ background: 'var(--navy)' }} />
                  Realizado
                </div>
                <div className="kpi-3col">
                  <KpiCard label="Grau execução" value={`${kpi.pct}%`}        color="navy" />
                  <KpiCard label="Conc. geral"   value={`${kpi.geralReal}%`}  color="navy" />
                  <KpiCard label="Conc. à data"  value={`${kpi.aDataReal}%`}  color="navy" />
                </div>
              </div>
              <div className="ind-section">
                <div className="ind-section-header">
                  <span className="ind-dot" style={{ background: 'var(--green)' }} />
                  Objectivo
                </div>
                <div className="kpi-3col ind-dashed">
                  <KpiCard label="Exec. obj."       value={`${kpi.pctPrev}%`}  color="green" />
                  <KpiCard label="Conc. geral obj." value={`${kpi.geralObj}%`} color="green" />
                  <KpiCard label="Conc. data obj."  value="100%"               color="green" />
                </div>
              </div>
            </Card>

            <Card
              title="Riscos"
              actions={<span className="pds-kpi-risk-active">{riskKpis.open} activos</span>}
            >
              <div className="kpi-2col">
                <KpiCard label="Total"     value={riskKpis.total}     />
                <KpiCard label="Críticos"  value={riskKpis.critical}  color="red"   />
                <KpiCard label="Abertos"   value={riskKpis.open}      color="amber" />
                <KpiCard label="Mitigados" value={riskKpis.mitigated} color="green" />
              </div>
            </Card>
          </div>

          {/* 2×2 card grid */}
          <div className="pds-grid">
            <Card
              title={<>Compromissos anteriores <span className="pds-section-count">({visibleCommitments.length})</span></>}
              actions={<SortBtn dir={commitSort} onToggle={() => setCommitSort(d => d === 'asc' ? 'desc' : 'asc')} />}
            >
              <ItemList items={sortItems(visibleCommitments, commitSort)} showMeta emptyMessage="Sem compromissos anteriores." />
              {hiddenCommitmentsCount > 0 && (
                <p className="pds-hidden-note">
                  {hiddenCommitmentsCount} compromisso{hiddenCommitmentsCount !== 1 ? 's' : ''}{' '}
                  concluído{hiddenCommitmentsCount !== 1 ? 's' : ''} há mais de {hideCompletedDays} dias{' '}
                  {hiddenCommitmentsCount !== 1 ? 'foram ocultados' : 'foi ocultado'}
                </p>
              )}
            </Card>
            <Card
              title={<>Principais avanços <span className="pds-section-count">({visProgress.length})</span></>}
              actions={<SortBtn dir={progressSort} onToggle={() => setProgressSort(d => d === 'asc' ? 'desc' : 'asc')} />}
            >
              <ItemList items={sortItems(visProgress, progressSort)} variant="progress" showMeta emptyMessage="Sem avanços registados." />
            </Card>
            <Card
              title={<>Próximos passos <span className="pds-section-count">({visNextSteps.length})</span></>}
              actions={<SortBtn dir={nextSort} onToggle={() => setNextSort(d => d === 'asc' ? 'desc' : 'asc')} />}
            >
              <ItemList items={sortItems(visNextSteps, nextSort)} showMeta emptyMessage="Sem próximos passos definidos." />
            </Card>
            <Card
              title={<>Pontos de atenção <span className="pds-section-count">({visAttention.length})</span></>}
              className="pds-attention-card"
              actions={<SortBtn dir={attnSort} onToggle={() => setAttnSort(d => d === 'asc' ? 'desc' : 'asc')} />}
            >
              <ItemList items={sortItems(visAttention, attnSort)} variant="attention" showMeta emptyMessage="Sem pontos de atenção identificados." />
            </Card>
          </div>

          {/* Risks — matrix + detail table (KPIs moved to top row card) */}
          <Card title="Riscos">
            {planRisks.length === 0 ? (
              <p className="pds-empty">Sem riscos identificados para este plano.</p>
            ) : (
              <div className="pds-risks-split" onClick={e => { if (e.target === e.currentTarget) setSelectedRiskIds([]) }}>
                <RiskMatrix
                  risks={planRisks}
                  size={matrixSize}
                  thresholds={thresholds}
                  selectedIds={selectedRiskIds}
                  onSelect={handleSelectRisk}
                />
                <RiskTable
                  risks={planRisks}
                  size={matrixSize}
                  thresholds={thresholds}
                  selectedIds={selectedRiskIds}
                  onSelect={handleSelectRisk}
                />
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
