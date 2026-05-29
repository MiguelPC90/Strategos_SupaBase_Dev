import './PontoSituacao.css'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react'
import Spinner from '../../components/Spinner/Spinner'
import EmptyState from '../../components/EmptyState/EmptyState'
import Card from '../../components/Card/Card'
import SmartKpi from '../../components/Kpi/SmartKpi'
import ContagemKpi from '../../components/Kpi/ContagemKpi'
import RiskMatrix from '../../components/RiskMatrix/RiskMatrix'
import InteractiveRiskMatrix from '../../components/InteractiveRiskMatrix/InteractiveRiskMatrix'
import SortIcon from '../../components/SortIcon/SortIcon'
import { estadoBadge } from '../../lib/riskHelpers'
import Badge from '../../components/Badge/Badge'
import ItemDetailModal from '../../components/ItemDetailModal/ItemDetailModal'
import { fmtDate, statusVariant, displayStatus, renderText, TODAY } from '../../lib/pdsHelpers'
import { usePdsEntries, usePdsConsolidated } from '../../hooks/usePdsEntries'
import { usePlanos } from '../../hooks/usePlanos'
import { usePermissions } from '../../hooks/usePermissions'
import { useAccessiblePrograms } from '../../hooks/useAccessiblePrograms'
import { useRisks } from '../../hooks/useRisks'
import { useActivities } from '../../hooks/useActivities'
import { useFilters } from '../../context/FilterContext'

import { leafPctPrev } from '../../lib/rollup'
import { useEffectiveValues } from '../../hooks/useEffectiveValues'
import { supabase } from '../../lib/supabase'
import type { PdsItem, Risk } from '../../types/index'
import { gradeStyle, gradeLabel, DEFAULT_THRESHOLDS, type RiskThresholds } from '../../lib/riskColors'
import {
  computeHealth, DEFAULT_HEALTH_CONFIG,
  type HealthConfig, type HealthInput,
} from '../../lib/healthRules'

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
      {dir === 'asc' ? <ArrowUp size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} /> : <ArrowDown size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} />}
    </button>
  )
}

// ── PDS item list ──────────────────────────────────────────────
const TRUNCATE_LIMIT = 200

type ItemListVariant = 'default' | 'attention' | 'progress'

interface ItemListProps {
  items: PdsItem[]
  variant?: ItemListVariant
  emptyMessage?: string
  showMeta?: boolean
}

function ItemList({ items, variant = 'default', emptyMessage = 'Sem itens.', showMeta }: ItemListProps) {
  const [selectedItem, setSelectedItem] = useState<PdsItem | null>(null)
  const openModal  = (item: PdsItem) => setSelectedItem(item)
  const closeModal = () => setSelectedItem(null)

  if (items.length === 0) {
    return <p className="pds-empty">{emptyMessage}</p>
  }

  const modal = selectedItem
    ? <ItemDetailModal item={selectedItem} onClose={closeModal} />
    : null

  // Plain-text fallback for progress + attention: all items lack date AND status
  if ((variant === 'progress' || variant === 'attention') && items.every(item => !item.date && !item.status)) {
    return (
      <>
        <div className="pds-progress-wrap">
          {items.map((item) => {
            const isLong = item.text.length > TRUNCATE_LIMIT
            const displayText = isLong ? item.text.slice(0, TRUNCATE_LIMIT) + '…' : item.text
            return (
              <p key={item.id} className="pds-progress-para">
                {renderText(displayText)}
                {isLong && (
                  <button type="button" className="pds-item-toggle" onClick={() => openModal(item)}>
                    Ver mais
                  </button>
                )}
                {showMeta && item.created_at && (
                  <span className="pds-item-created">
                    {item.author ? `${item.author} · ` : ''}{fmtDate(item.created_at.slice(0, 10))}
                  </span>
                )}
              </p>
            )
          })}
        </div>
        {modal}
      </>
    )
  }

  return (
    <>
      <div className="pds-item-rows">
        <div className="pds-item-header">
          <span className="pds-item-header-label col-item">Item</span>
          <span className="pds-item-header-label col-date">Data</span>
          <span className="pds-item-header-label col-status">Estado</span>
        </div>
        {items.map((item) => {
          const ds = displayStatus(item)
          const isLong = item.text.length > TRUNCATE_LIMIT
          const displayText = isLong ? item.text.slice(0, TRUNCATE_LIMIT) + '…' : item.text
          return (
            <div
              key={item.id}
              className={`pds-item-row${variant === 'attention' ? ' pds-attention-row' : ''}`}
            >
              <span className="pds-item-text">
                {renderText(displayText)}
                {isLong && (
                  <button type="button" className="pds-item-toggle" onClick={() => openModal(item)}>
                    Ver mais
                  </button>
                )}
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
      {modal}
    </>
  )
}

// ── Risk helpers ────────────────────────────────────────────────

// ── Risk table component ──────────────────────────────────────
type RiskSortKey = 'description' | 'impact' | 'probability' | 'grade' | 'status' | 'mitigation'

interface RiskTableProps {
  risks: Risk[]
  size: number
  thresholds: RiskThresholds
  selectedIds: string[]
  onSelect: (ids: string[]) => void
}

function RiskTable({ risks, size, thresholds, selectedIds, onSelect }: RiskTableProps) {
  const [sortBy,  setSortBy]  = useState<RiskSortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = useCallback((key: RiskSortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }, [sortBy])

  const sortedRisks = useMemo(() => {
    if (!sortBy) return risks
    return [...risks].sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'description':  cmp = a.description.localeCompare(b.description); break
        case 'impact':       cmp = a.impact - b.impact; break
        case 'probability':  cmp = a.probability - b.probability; break
        case 'grade':        cmp = (a.impact * a.probability) - (b.impact * b.probability); break
        case 'status':       cmp = a.status.localeCompare(b.status); break
        case 'mitigation':   cmp = (a.mitigation || '').localeCompare(b.mitigation || ''); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [risks, sortBy, sortDir])

  return (
    <div className="pds-risk-table-wrap">
      <div className="pds-risk-table-header">
        <span className="pds-th-sortable" onClick={() => handleSort('description')}>
          <span className="pds-th-content">Descrição <SortIcon active={sortBy === 'description'} dir={sortDir} /></span>
        </span>
        <span className="pds-tc pds-th-sortable" onClick={() => handleSort('impact')}>
          <span className="pds-th-content">Impacto <SortIcon active={sortBy === 'impact'} dir={sortDir} /></span>
        </span>
        <span className="pds-tc pds-th-sortable" onClick={() => handleSort('probability')}>
          <span className="pds-th-content">Prob. <SortIcon active={sortBy === 'probability'} dir={sortDir} /></span>
        </span>
        <span className="pds-tc pds-th-sortable" onClick={() => handleSort('grade')}>
          <span className="pds-th-content">Grau <SortIcon active={sortBy === 'grade'} dir={sortDir} /></span>
        </span>
        <span className="pds-tc pds-th-sortable" onClick={() => handleSort('status')}>
          <span className="pds-th-content">Estado <SortIcon active={sortBy === 'status'} dir={sortDir} /></span>
        </span>
        <span className="pds-th-sortable" onClick={() => handleSort('mitigation')}>
          <span className="pds-th-content">Mitigação <SortIcon active={sortBy === 'mitigation'} dir={sortDir} /></span>
        </span>
      </div>
      {sortedRisks.map(r => {
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
              <Badge variant={estadoBadge(r.status)}>{r.status}</Badge>
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
  const { filters, setFilter } = useFilters()
  const programs = useAccessiblePrograms()
  const n1Name = filters.n1Values[0] ?? null
  const n2Name = filters.n2Values[0] ?? null

  // ── State ──────────────────────────────────────────────────
  const [hideCompletedDays, setHideCompletedDays] = useState(90)
  const [selectedRiskIds,   setSelectedRiskIds]   = useState<string[]>([])
  const [matrixSize,        setMatrixSize]        = useState(5)
  const [thresholds,        setThresholds]        = useState<RiskThresholds>(DEFAULT_THRESHOLDS)
  const [healthConfig,      setHealthConfig]      = useState<HealthConfig>(DEFAULT_HEALTH_CONFIG)
  const [commitSort,        setCommitSort]        = useState<SortDir>('asc')
  const [progressSort,      setProgressSort]      = useState<SortDir>('asc')
  const [nextSort,          setNextSort]          = useState<SortDir>('asc')
  const [attnSort,          setAttnSort]          = useState<SortDir>('asc')

  const { hasAccess } = usePermissions()

  // ── Data hooks ─────────────────────────────────────────────
  const programId = filters.programIds[0] ?? programs[0]?.id
  const { entries, loading: entriesLoading } = usePdsEntries(programId)
  const { planos }           = usePlanos(programId)
  const { risks }            = useRisks(programId)
  const { activities }       = useActivities({ program_id: programId })

  const accessiblePlanIds = useMemo(
    () => new Set(planos.filter(p => hasAccess('ponto-situacao', p.program_id ?? undefined, p.id)).map(p => p.id)),
    [planos, hasAccess],
  )

  // selectedKey derived from breadcrumb n2Name (plano name → plano id)
  // Only resolve if the plan is accessible
  const selectedKey = useMemo(
    () => {
      const found = planos.find(p => p.name === n2Name)
      return (found && accessiblePlanIds.has(found.id)) ? found.id : ''
    },
    [planos, n2Name, accessiblePlanIds]
  )
  const { items: consolidated, loading: consLoading } = usePdsConsolidated(selectedKey || undefined)
  const loading = entriesLoading || consLoading

  // ── Effects ────────────────────────────────────────────────

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
    planos.filter(p => accessiblePlanIds.has(p.id)).map(p => ({ key: p.id, label: p.name })),
    [planos, accessiblePlanIds]
  )

  const selectedPlano = useMemo(
    () => planos.find(p => p.id === selectedKey) ?? null,
    [planos, selectedKey]
  )

  const eff = useEffectiveValues(activities, TODAY)

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

  // N4 leaf activities for KPIs, filtered by plano_id (level === 4 is the canonical KPI unit)
  const planLeaves = useMemo(() => {
    if (!selectedKey) return []
    return activities.filter(a => a.plano_id === selectedKey && a.level === 4)
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
    const statuses   = planLeaves.map(a => eff.get(a.id)?.status ?? 'Em dia')
    const concluidas = statuses.filter(s => s === 'Concluída').length
    const emDia      = statuses.filter(s => s === 'Em dia').length
    const emRisco    = statuses.filter(s => s === 'Em risco').length
    const emAtraso   = statuses.filter(s => s === 'Em atraso').length
    const pct        = total > 0 ? Math.round(planLeaves.reduce((s, a) => s + (eff.get(a.id)?.pct ?? a.pct), 0) / total) : 0
    const pctPrev    = total > 0 ? Math.round(planLeaves.reduce((s, a) => s + leafPctPrev(a, TODAY), 0) / total) : 0
    const geralReal  = total > 0 ? Math.round((concluidas / total) * 100) : 0
    const geralObj   = total > 0 ? Math.round(((concluidas + emAtraso) / total) * 100) : 0
    const aDataReal  = (concluidas + emAtraso) > 0
      ? Math.round((concluidas / (concluidas + emAtraso)) * 100)
      : 0
    return { total, concluidas, emDia, emRisco, emAtraso, pct, pctPrev, geralReal, geralObj, aDataReal }
  }, [planLeaves, eff])

  // ── Plan navigation ────────────────────────────────────────
  // Scope arrows to eixo selected in breadcrumb (or all planos in program)
  const planosInScope = useMemo(
    () => n1Name ? planos.filter(p => p.eixo?.name === n1Name) : planos,
    [planos, n1Name]
  )
  const currentIdx = useMemo(
    () => planosInScope.findIndex(p => p.id === selectedKey),
    [planosInScope, selectedKey],
  )
  const goPrev = useCallback(() => {
    if (currentIdx > 0) setFilter('n2Values', [planosInScope[currentIdx - 1].name])
  }, [currentIdx, planosInScope, setFilter])
  const goNext = useCallback(() => {
    if (currentIdx < planosInScope.length - 1) setFilter('n2Values', [planosInScope[currentIdx + 1].name])
  }, [currentIdx, planosInScope, setFilter])

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
      const s = eff.get(a.id)?.status ?? 'Em dia'
      return s === 'Em atraso' || s === 'Em risco'
    }).length
    const avgPct    = total > 0 ? planLeaves.reduce((s, a) => s + (eff.get(a.id)?.pct ?? a.pct), 0) / total : 0
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
  }, [planLeaves, eff, planRisks, visAttention, thresholds])

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
      item.status === 'Concluído' &&
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

      {/* Empty / no-selection states */}
      {!loading && planOptions.length === 0 ? (
        <EmptyState
          icon="folder"
          title="Sem planos disponíveis"
          description="Não existem planos de acção disponíveis para este programa."
        />
      ) : !selectedKey ? (
        <div className="pds-placeholder">
          Seleccione um plano no filtro acima para ver o ponto de situação.
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
              ><ChevronLeft size={14} strokeWidth={1.5} /></button>
              <button
                className="pds-nav-btn"
                onClick={goNext}
                disabled={currentIdx >= planosInScope.length - 1}
                title="Plano seguinte (Alt+→)"
              ><ChevronRight size={14} strokeWidth={1.5} /></button>
            </div>
            <span className="pds-header-date">{fmtDate(planEntries[0]?.updated_at ?? TODAY)}</span>
          </div>

          {/* KPI brief — 2-column layout mirroring Dashboard */}
          <div className="pds-brief">
            <div className="pds-brief-grid">
              <div className="pds-brief-column pds-brief-column-main">
                <div className="pds-brief-header">
                  <h2 className="pds-brief-title">Resumo Executivo</h2>
                </div>
                <div className="pds-brief-card kpis-card">
                  <div className="executive-kpi-grid">
                    <SmartKpi label="Grau de Execução"    tooltipTerm="grau-execucao"       value={kpi.pct}       target={kpi.pctPrev} />
                    <SmartKpi label="Concretização Geral" tooltipTerm="concretizacao-geral" value={kpi.geralReal} target={kpi.geralObj} />
                    <SmartKpi label="Conc. à Data"        tooltipTerm="concretizacao-data"  value={kpi.aDataReal} target={100} />
                  </div>
                  <div className="contagem-kpi-grid">
                    <ContagemKpi value={kpi.concluidas} total={kpi.total} label="concluídas" tooltipTerm="estado-concluida"  deltaVariant="good" />
                    <ContagemKpi value={kpi.emDia}      total={kpi.total} label="em dia"     tooltipTerm="estado-em-dia"     deltaVariant="neutral" />
                    <ContagemKpi value={kpi.emRisco}    total={kpi.total} label="em risco"   tooltipTerm="estado-em-risco"   deltaVariant="bad" />
                    <ContagemKpi value={kpi.emAtraso}   total={kpi.total} label="em atraso"  tooltipTerm="estado-em-atraso"  variant="late" deltaVariant="bad" />
                  </div>
                </div>
              </div>

              <div className="pds-brief-column pds-brief-column-aside">
                <div className="pds-brief-header">
                  <h2 className="pds-brief-title">
                    Riscos · {riskKpis.total} total
                    {riskKpis.mitigated > 0 && ` · ${riskKpis.mitigated} mitigado${riskKpis.mitigated > 1 ? 's' : ''}`}
                  </h2>
                </div>
                <div className="pds-brief-card riscos-card">
                  <div className="riscos-card-body">
                    <div className="riscos-kpis-col">
                      <ContagemKpi value={riskKpis.critical} total={riskKpis.total} label="críticos" tooltipTerm="risco-critico" variant="late" />
                      <ContagemKpi value={riskKpis.open}     total={riskKpis.total} label="abertos"  tooltipTerm="risco" />
                    </div>
                    <div className="riscos-matrix-wrapper">
                      <RiskMatrix
                        risks={planRisks.filter(r => {
                          const s = r.status.toLowerCase()
                          return s !== 'fechado' && s !== 'mitigado'
                        })}
                        size={matrixSize}
                        thresholds={thresholds}
                        compact
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
                <InteractiveRiskMatrix
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
