import './PontoSituacao.css'
import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import Spinner from '../../components/Spinner/Spinner'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import { usePdsEntries } from '../../hooks/usePdsEntries'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import { useRisks } from '../../hooks/useRisks'
import { useActivities } from '../../hooks/useActivities'
import { useFilters } from '../../context/FilterContext'
import { useToast } from '../../context/ToastContext'
import { leafStatus, leafPctPrev } from '../../lib/rollup'
import { supabase } from '../../lib/supabase'
import type { PdsItem, PdsEntry, Risk } from '../../types/index'
import { gradeStyle, gradeLabel } from '../../lib/riskColors'

const TODAY = new Date().toISOString().slice(0, 10)

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
}

function ItemList({ items, variant = 'default' }: ItemListProps) {
  if (items.length === 0) {
    return <p className="pds-empty">Sem itens.</p>
  }

  // Plain-text fallback for progress + attention: all items lack date AND status
  if ((variant === 'progress' || variant === 'attention') && items.every(item => !item.date && !item.status)) {
    return (
      <div className="pds-progress-wrap">
        {items.map((item, i) => (
          <p key={i} className="pds-progress-para">{renderText(item.text)}</p>
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
            <span className="pds-item-text">{renderText(item.text)}</span>
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
  selectedIds: string[]
  onSelect: (ids: string[]) => void
}

function RiskMatrix({ risks, size, selectedIds, onSelect }: RiskMatrixProps) {
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
      const gs    = gradeStyle(grade, size)
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
            <div className="pds-risk-matrix" style={{ gridTemplateColumns: gridCols }}>
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
  selectedIds: string[]
  onSelect: (ids: string[]) => void
}

function RiskTable({ risks, size, selectedIds, onSelect }: RiskTableProps) {
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
        const gs    = gradeStyle(grade, size)
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
              <span className="pds-risk-grade" style={{ background: gs.bg, color: gs.color }} title={gradeLabel(grade, size)}>
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
  const { programs }  = usePrograms()
  const { showToast } = useToast()

  // ── State ──────────────────────────────────────────────────
  const [selProgId,         setSelProgId]         = useState<string | null>(null)
  const [selectedKey,       setSelectedKey]       = useState('')
  const [hideCompletedDays, setHideCompletedDays] = useState(90)
  const [adjustedEntry,     setAdjustedEntry]     = useState<PdsEntry | null>(null)
  const [selectedRiskIds,   setSelectedRiskIds]   = useState<string[]>([])
  const [matrixSize,        setMatrixSize]        = useState(5)
  const lastProcessedId = useRef<string | null>(null)

  // ── Data hooks ─────────────────────────────────────────────
  const programId = selProgId ?? undefined
  const { entries, loading } = usePdsEntries(programId)
  const { planos }           = usePlanos(programId)
  const { risks }            = useRisks(programId)
  const { activities }       = useActivities({ program_id: programId })

  // ── Effects ────────────────────────────────────────────────

  // Initialize selProgId from global filter or first program
  useEffect(() => {
    if (programs.length === 0) return
    setSelProgId(prev => {
      if (prev && programs.some(p => p.id === prev)) return prev
      return filters.programIds[0] ?? programs[0].id
    })
  }, [programs, filters.programIds])

  // Reset plan selection when program changes
  useEffect(() => {
    setSelectedKey('')
  }, [selProgId])

  // Reset adjusted entry + process flag + risk selection when plan changes
  useEffect(() => {
    setAdjustedEntry(null)
    lastProcessedId.current = null
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
    supabase.from('app_config').select('data').eq('config_key', 'risk_matrix_size').single()
      .then(({ data }) => {
        if (data) {
          const v = parseInt(data.data ?? '')
          if (!isNaN(v) && v >= 2 && v <= 8) setMatrixSize(v)
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

  // ── Auto-transition: next_steps → commitments ─────────────
  useEffect(() => {
    const rawEntry = planEntries[0] ?? null
    if (!rawEntry || lastProcessedId.current === rawEntry.id) return
    lastProcessedId.current = rawEntry.id

    const nextSteps = rawEntry.next_steps_items ?? []
    const toMove = nextSteps.filter(item =>
      item.status === 'Concluído' || item.status === 'Concluída' ||
      (item.date && item.date < TODAY)
    )

    if (toMove.length === 0) return  // nothing to do; display uses planEntries[0]

    const toMoveSet      = new Set(toMove)
    const remaining      = nextSteps.filter(item => !toMoveSet.has(item))
    const newCommitments = [...(rawEntry.commitments_items ?? []), ...toMove]

    setAdjustedEntry({ ...rawEntry, next_steps_items: remaining, commitments_items: newCommitments })
    showToast(
      `${toMove.length} ${toMove.length === 1 ? 'item transitou' : 'itens transitaram'} para Compromissos Anteriores`
    )
    void supabase.from('pds_entries').update({
      next_steps_items:  remaining,
      commitments_items: newCommitments,
    }).eq('id', rawEntry.id)
  }, [planEntries, showToast])

  // Latest entry, post-transition
  const entry     = adjustedEntry ?? (planEntries[0] ?? null)
  const planLabel = planOptions.find(o => o.key === selectedKey)?.label ?? ''

  // ── KPI computations ───────────────────────────────────────
  const kpi = useMemo(() => {
    const total = planLeaves.length
    if (total === 0) return null
    const statuses   = planLeaves.map(a => leafStatus(a, TODAY))
    const concluidas = statuses.filter(s => s === 'Concluída').length
    const emDia      = statuses.filter(s => s === 'Em dia').length
    const emAtraso   = statuses.filter(s => s === 'Em atraso').length
    const pct        = Math.round(planLeaves.reduce((s, a) => s + a.pct, 0) / total)
    const pctPrev    = Math.round(planLeaves.reduce((s, a) => s + leafPctPrev(a, TODAY), 0) / total)
    const geralReal  = Math.round((concluidas / total) * 100)
    const geralObj   = Math.round(((concluidas + emAtraso) / total) * 100)
    const aDataReal  = (concluidas + emAtraso) > 0
      ? Math.round((concluidas / (concluidas + emAtraso)) * 100)
      : 0
    return { total, concluidas, emDia, emAtraso, pct, pctPrev, geralReal, geralObj, aDataReal }
  }, [planLeaves])

  // ── Filter old completed commitments ──────────────────────
  const { visibleCommitments, hiddenCommitmentsCount } = useMemo(() => {
    const items = entry?.commitments_items ?? []
    if (hideCompletedDays <= 0) return { visibleCommitments: items, hiddenCommitmentsCount: 0 }
    const cutoff = new Date(TODAY)
    cutoff.setDate(cutoff.getDate() - hideCompletedDays)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const hidden = items.filter(item =>
      (item.status === 'Concluído' || item.status === 'Concluída') &&
      item.date && item.date < cutoffStr
    )
    return {
      visibleCommitments:     items.filter(i => !hidden.includes(i)),
      hiddenCommitmentsCount: hidden.length,
    }
  }, [entry, hideCompletedDays])

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
        {programs.length > 1 && (
          <>
            <span className="pds-selector-label">Programa</span>
            <select
              className="styled-select"
              value={selProgId ?? ''}
              onChange={e => setSelProgId(e.target.value || null)}
            >
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span className="pds-selector-sep" />
          </>
        )}
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
      {!selectedKey ? (
        <div className="pds-placeholder">
          Seleccione um plano para ver o ponto de situação.
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Spinner />
        </div>
      ) : planEntries.length === 0 ? (
        <div className="pds-placeholder">Sem pontos de situação para este plano.</div>
      ) : (
        <>
          {/* Header bar — navy, plan path + latest date */}
          <div className="pds-header-bar">
            <span className="pds-header-path">{planLabel}</span>
            {entry && (
              <span className="pds-header-date">{fmtDate(entry.updated_at)}</span>
            )}
          </div>

          {/* KPI row */}
          {kpi && (
            <div className="pds-kpi-row">

              {/* Card 1 — Dados Gerais */}
              <div className="pds-kpi-card">
                <div className="pds-kpi-card-title">Dados Gerais</div>
                <div className="pds-kpi-grid-2x2">
                  <div className="pds-kpi-cell">
                    <span className="pds-kpi-label">Total</span>
                    <span className="pds-kpi-value pds-kpi-navy">{kpi.total}</span>
                  </div>
                  <div className="pds-kpi-cell">
                    <span className="pds-kpi-label">Concluídas</span>
                    <span className="pds-kpi-value pds-kpi-green">{kpi.concluidas}</span>
                  </div>
                  <div className="pds-kpi-cell">
                    <span className="pds-kpi-label">Em dia</span>
                    <span className="pds-kpi-value pds-kpi-green">{kpi.emDia}</span>
                  </div>
                  <div className="pds-kpi-cell">
                    <span className="pds-kpi-label">Em atraso</span>
                    <span className="pds-kpi-value pds-kpi-red">{kpi.emAtraso}</span>
                  </div>
                </div>
              </div>

              {/* Card 2 — Grau de Execução */}
              <div className="pds-kpi-card">
                <div className="pds-kpi-card-title">Grau de Execução</div>
                <div className="pds-kpi-exec-row">
                  <div className="pds-kpi-exec-cell">
                    <span className="pds-kpi-exec-label">Realizado</span>
                    <span className="pds-kpi-exec-value pds-kpi-navy">{kpi.pct}%</span>
                  </div>
                  <div className="pds-kpi-exec-cell pds-kpi-exec-dashed">
                    <span className="pds-kpi-exec-label">Objectivo</span>
                    <span className="pds-kpi-exec-value pds-kpi-green">{kpi.pctPrev}%</span>
                  </div>
                </div>
              </div>

              {/* Card 3 — Concretização */}
              <div className="pds-kpi-card">
                <div className="pds-kpi-card-title">Concretização</div>
                <div className="pds-kpi-grid-2x2">
                  <div className="pds-kpi-cell">
                    <span className="pds-kpi-label">Geral real</span>
                    <span className="pds-kpi-sublabel">N.º Conc. / Total</span>
                    <span className="pds-kpi-value pds-kpi-navy">{kpi.geralReal}%</span>
                  </div>
                  <div className="pds-kpi-cell pds-kpi-cell-dashed">
                    <span className="pds-kpi-label">Geral obj.</span>
                    <span className="pds-kpi-sublabel">(Conc.+Atr.) / Total</span>
                    <span className="pds-kpi-value pds-kpi-green">{kpi.geralObj}%</span>
                  </div>
                  <div className="pds-kpi-cell">
                    <span className="pds-kpi-label">À data real</span>
                    <span className="pds-kpi-sublabel">Conc. / (Conc.+Atr.)</span>
                    <span className="pds-kpi-value pds-kpi-navy">{kpi.aDataReal}%</span>
                  </div>
                  <div className="pds-kpi-cell pds-kpi-cell-dashed">
                    <span className="pds-kpi-label">À data obj.</span>
                    <span className="pds-kpi-sublabel">Objectivo</span>
                    <span className="pds-kpi-value pds-kpi-green">100%</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 2×2 card grid */}
          <div className="pds-grid">
            <Card title={<>Compromissos anteriores <span className="pds-section-count">({visibleCommitments.length})</span></>}>
              <ItemList items={visibleCommitments} />
              {hiddenCommitmentsCount > 0 && (
                <p className="pds-hidden-note">
                  {hiddenCommitmentsCount} compromisso{hiddenCommitmentsCount !== 1 ? 's' : ''}{' '}
                  concluído{hiddenCommitmentsCount !== 1 ? 's' : ''} há mais de {hideCompletedDays} dias{' '}
                  {hiddenCommitmentsCount !== 1 ? 'foram ocultados' : 'foi ocultado'}
                </p>
              )}
            </Card>
            <Card title={<>Principais avanços <span className="pds-section-count">({(entry?.progress_items ?? []).length})</span></>}>
              <ItemList items={entry?.progress_items ?? []} variant="progress" />
            </Card>
            <Card title={<>Próximos passos <span className="pds-section-count">({(entry?.next_steps_items ?? []).length})</span></>}>
              <ItemList items={entry?.next_steps_items ?? []} />
            </Card>
            <Card title={<>Pontos de atenção <span className="pds-section-count">({(entry?.attention_items ?? []).length})</span></>} className="pds-attention-card">
              <ItemList items={entry?.attention_items ?? []} variant="attention" />
            </Card>
          </div>

          {/* Risks — split layout: heatmap matrix + detail table */}
          <Card title="Riscos">
            {planRisks.length === 0 ? (
              <p className="pds-empty pds-risks-empty">Sem riscos registados para este plano.</p>
            ) : (
              <div className="pds-risks-split" onClick={e => { if (e.target === e.currentTarget) setSelectedRiskIds([]) }}>
                <RiskMatrix
                  risks={planRisks}
                  size={matrixSize}
                  selectedIds={selectedRiskIds}
                  onSelect={handleSelectRisk}
                />
                <RiskTable
                  risks={planRisks}
                  size={matrixSize}
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
