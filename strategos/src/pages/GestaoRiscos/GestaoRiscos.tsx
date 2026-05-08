import './GestaoRiscos.css'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import Spinner from '../../components/Spinner/Spinner'
import { createPortal } from 'react-dom'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import Modal from '../../components/Modal/Modal'
import EmptyState from '../../components/EmptyState/EmptyState'
import { useRisks } from '../../hooks/useRisks'
import { supabase } from '../../lib/supabase'
import type { Risk } from '../../types/index'
import { gradeStyle, gradeLabel, DEFAULT_THRESHOLDS, type RiskThresholds } from '../../lib/riskColors'
import { estadoBadge } from '../../lib/riskHelpers'
import { useCanEditCurrent } from '../../hooks/useCanEditCurrent'
import InteractiveRiskMatrix from '../../components/InteractiveRiskMatrix/InteractiveRiskMatrix'
import SortIcon from '../../components/SortIcon/SortIcon'

// ── Types ──────────────────────────────────────────────────────
interface RiskForm {
  id:          string | null
  description: string
  impact:      string   // '1'–'5'
  probability: string   // '1'–'5'
  status:      string
  mitigation:  string
}

// ── Helpers ────────────────────────────────────────────────────
function calcGrau(impact: number, prob: number): number {
  return impact * prob
}

function blankForm(): RiskForm {
  return {
    id: null, description: '', impact: '3',
    probability: '3', status: 'Aberto', mitigation: '',
  }
}

function toForm(r: Risk): RiskForm {
  return {
    id: r.id,
    description: r.description,
    impact:      String(r.impact),
    probability: String(r.probability),
    status:      r.status,
    mitigation:  r.mitigation,
  }
}

// ── Panel ──────────────────────────────────────────────────────
interface PanelProps {
  form:       RiskForm
  onChange:   (f: RiskForm) => void
  matrixSize: number
  thresholds: RiskThresholds
}

function Panel({ form, onChange, matrixSize, thresholds }: PanelProps) {
  const set =
    (k: keyof RiskForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ ...form, [k]: e.target.value } as RiskForm)

  const grauVal = calcGrau(Number(form.impact), Number(form.probability))
  const grauGs  = gradeStyle(grauVal, matrixSize, thresholds)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="gr-field">
        <span className="gr-field-label">Descrição *</span>
        <textarea
          className="gr-field-textarea"
          value={form.description}
          onChange={set('description')}
          rows={3}
          placeholder="Descreva o risco…"
        />
      </div>

      <div className="gr-field-row">
        <div className="gr-field">
          <span className="gr-field-label">Impacto *</span>
          <select className="styled-select-sm" value={form.impact} onChange={set('impact')}>
            {Array.from({ length: matrixSize }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="gr-field">
          <span className="gr-field-label">Probabilidade *</span>
          <select className="styled-select-sm" value={form.probability} onChange={set('probability')}>
            {Array.from({ length: matrixSize }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="gr-field">
        <span className="gr-field-label">Grau de Risco</span>
        <div className="gr-grau-display">
          <span className="gr-grau-num">{grauVal}</span>
          <span
            className="gr-grau-badge"
            style={{ background: grauGs.bg, color: grauGs.color, borderColor: grauGs.border }}
            title={gradeLabel(grauVal, matrixSize, thresholds)}
          >
            {gradeLabel(grauVal, matrixSize, thresholds)}
          </span>
        </div>
      </div>

      <div className="gr-field">
        <span className="gr-field-label">Estado *</span>
        <select className="styled-select-sm" value={form.status} onChange={set('status')}>
          <option>Aberto</option>
          <option>Em mitigação</option>
          <option>Mitigado</option>
          <option>Fechado</option>
        </select>
      </div>

      <div className="gr-field">
        <span className="gr-field-label">Mitigação</span>
        <textarea
          className="gr-field-textarea"
          value={form.mitigation}
          onChange={set('mitigation')}
          rows={3}
          placeholder="Medidas de mitigação…"
        />
      </div>
    </div>
  )
}

// ── ⋯ Row menu ─────────────────────────────────────────────────
interface RowMenuProps {
  riskId:     string
  openId:     string | null
  onOpen:     (id: string | null) => void
  onEdit:     () => void
  onDuplicate: () => void
  onDelete:   () => void
}

const MENU_H = 130

function RowMenu({ riskId, openId, onOpen, onEdit, onDuplicate, onDelete }: RowMenuProps) {
  const open   = openId === riskId
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect       = btnRef.current.getBoundingClientRect()
      const right      = window.innerWidth - rect.right
      const spaceBelow = window.innerHeight - rect.bottom
      setPos(
        spaceBelow >= MENU_H
          ? { top: rect.bottom + 4, right }
          : { bottom: window.innerHeight - rect.top + 4, right },
      )
    }
    onOpen(open ? null : riskId)
  }

  const menu = (
    <div
      className="gr-menu"
      style={{ position: 'fixed', zIndex: 300, ...(pos ?? {}) }}
      onClick={e => e.stopPropagation()}
    >
      <button className="gr-menu-item" onClick={() => { onOpen(null); onEdit() }}>
        Editar
      </button>
      <button className="gr-menu-item" onClick={() => { onOpen(null); onDuplicate() }}>
        Duplicar
      </button>
      <div className="gr-menu-sep" />
      <button className="gr-menu-item danger" onClick={() => { onOpen(null); onDelete() }}>
        Eliminar
      </button>
    </div>
  )

  return (
    <div className="gr-menu-wrap">
      <button ref={btnRef} className="btn-icon" onClick={handleClick} title="Acções">
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>
      {open && pos !== null && createPortal(menu, document.body)}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
interface GestaoRiscosProps {
  planoId?:   string
  programId?: string
}

export default function GestaoRiscos({ planoId, programId }: GestaoRiscosProps = {}) {
  const { showToast } = useToast()
  const readOnly = !useCanEditCurrent('gestao-riscos')
  const [matrixSize,  setMatrixSize]  = useState(5)
  const [thresholds,  setThresholds]  = useState<RiskThresholds>(DEFAULT_THRESHOLDS)

  // Fetch risk matrix config from app_config
  useEffect(() => {
    supabase.from('app_config').select('config_key, data')
      .in('config_key', ['risk_matrix_size', 'risk_thresholds'])
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, string> = {}
        for (const row of data) map[row.config_key] = row.data
        if (map['risk_matrix_size']) {
          const parsed = parseInt(map['risk_matrix_size'])
          if (!isNaN(parsed) && parsed > 0) setMatrixSize(parsed)
        }
        if (map['risk_thresholds']) {
          try { setThresholds({ ...DEFAULT_THRESHOLDS, ...JSON.parse(map['risk_thresholds']) }) }
          catch { /* keep defaults */ }
        }
      })
  }, [])

  const { risks, loading, refetch } = useRisks(programId)

  // Filter risks for selected plano
  const planRisks = useMemo<Risk[]>(() => {
    if (!planoId) return []
    return risks.filter(r => r.plano_id === planoId)
  }, [risks, planoId])

  // ── Selection state ──────────────────────────────────────────
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([])

  const handleSelectRisk = useCallback((ids: string[]) => {
    setSelectedRiskIds(prev => {
      const sameSet = prev.length === ids.length && ids.every(id => prev.includes(id))
      return sameSet ? [] : ids
    })
  }, [])

  // ── Menu state ───────────────────────────────────────────────
  const [menuId, setMenuId] = useState<string | null>(null)

  useEffect(() => {
    if (!menuId) return
    const h = () => setMenuId(null)
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [menuId])

  // ── Panel state ──────────────────────────────────────────────
  const [panelForm,   setPanelForm]   = useState<RiskForm | null>(null)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelErr,    setPanelErr]    = useState('')

  // ── Panel open/close ─────────────────────────────────────────
  const openNew = useCallback(() => {
    setPanelForm(blankForm())
    setPanelErr('')
  }, [])

  const openEdit = useCallback((r: Risk) => {
    setPanelForm(toForm(r))
    setPanelErr('')
  }, [])

  const openDuplicate = useCallback((r: Risk) => {
    setPanelForm({
      ...toForm(r),
      id:          null,
      description: r.description + ' (cópia)',
    })
    setPanelErr('')
  }, [])

  const closePanel = useCallback(() => {
    setPanelForm(null)
    setPanelErr('')
  }, [])

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!panelForm || !planoId) return
    if (!panelForm.description.trim()) {
      setPanelErr('Descrição obrigatória.')
      return
    }
    setPanelSaving(true)
    setPanelErr('')

    const payload = {
      description: panelForm.description.trim(),
      impact:      Number(panelForm.impact),
      probability: Number(panelForm.probability),
      status:      panelForm.status,
      mitigation:  panelForm.mitigation,
    }

    let errMsg = ''
    if (panelForm.id) {
      const { error } = await supabase
        .from('risks')
        .update(payload)
        .eq('id', panelForm.id)
      if (error) errMsg = error.message
    } else {
      const { error } = await supabase
        .from('risks')
        .insert({
          ...payload,
          plano_id:   planoId,
          program_id: programId,
          sort_order: planRisks.length,
        })
      if (error) errMsg = error.message
    }

    setPanelSaving(false)
    if (errMsg) { setPanelErr(errMsg); return }
    setPanelForm(null)
    showToast('Guardado!')
    refetch()
  }, [panelForm, planoId, programId, planRisks.length, refetch])

  // ── Delete from panel footer ──────────────────────────────────
  const handlePanelDelete = useCallback(async () => {
    const id = panelForm?.id
    if (!id) return
    if (!confirm('Eliminar este risco? Esta acção não pode ser desfeita.')) return
    setPanelSaving(true)
    const { error } = await supabase.from('risks').delete().eq('id', id)
    setPanelSaving(false)
    if (error) { setPanelErr(error.message); return }
    setPanelForm(null)
    showToast('Eliminado.', 'info')
    refetch()
  }, [panelForm, refetch])

  // ── Delete from row menu ──────────────────────────────────────
  const handleRowDelete = useCallback(async (r: Risk) => {
    const preview = r.description.length > 40
      ? r.description.slice(0, 40) + '…'
      : r.description
    if (!confirm(`Eliminar "${preview}"? Esta acção não pode ser desfeita.`)) return
    const { error } = await supabase.from('risks').delete().eq('id', r.id)
    if (error) { alert(`Erro ao eliminar: ${error.message}`); return }
    showToast('Eliminado.', 'info')
    refetch()
  }, [refetch])

  // ── Sort state ────────────────────────────────────────────────
  type SortKey = 'description' | 'impact' | 'probability' | 'grade' | 'status' | 'mitigation'
  const [sortBy,  setSortBy]  = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = useCallback((key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }, [sortBy])

  const sortedRisks = useMemo(() => {
    if (!sortBy) return planRisks
    return [...planRisks].sort((a, b) => {
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
  }, [planRisks, sortBy, sortDir])

  return (
    <div className="gr-page">
      {/* Action bar */}
      {!readOnly && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            className="btn-primary"
            onClick={openNew}
            disabled={!planoId}
          >
            Novo Risco
          </button>
        </div>
      )}

      {/* Risk table */}
      <Card title="Riscos">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Spinner />
          </div>
        ) : planRisks.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="Sem riscos registados"
            description="Ainda não existem riscos identificados para este plano."
            {...(!readOnly && { actionLabel: '+ Novo Risco', onAction: openNew })}
          />
        ) : (
          <div
            className="gr-risks-split"
            onClick={e => { if (e.target === e.currentTarget) setSelectedRiskIds([]) }}
          >
            <div className="gr-risks-matrix-wrap">
              <InteractiveRiskMatrix
                risks={planRisks}
                size={matrixSize}
                thresholds={thresholds}
                selectedIds={selectedRiskIds}
                onSelect={handleSelectRisk}
              />
            </div>
            <div className="gr-risks-table-wrap">
            <table className="gr-table tbl-default">
              <colgroup>
                <col />
                <col style={{ width: 70 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 130 }} />
                <col />
                <col style={{ width: 44 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="t-label gr-th-sortable" onClick={() => handleSort('description')}>
                    <span className="gr-th-content">Descrição <SortIcon active={sortBy === 'description'} dir={sortDir} /></span>
                  </th>
                  <th className="gr-th-c t-label gr-th-sortable" onClick={() => handleSort('impact')}>
                    <span className="gr-th-content">Impacto <SortIcon active={sortBy === 'impact'} dir={sortDir} /></span>
                  </th>
                  <th className="gr-th-c t-label gr-th-sortable" onClick={() => handleSort('probability')}>
                    <span className="gr-th-content">Probabilidade <SortIcon active={sortBy === 'probability'} dir={sortDir} /></span>
                  </th>
                  <th className="gr-th-c t-label gr-th-sortable" onClick={() => handleSort('grade')}>
                    <span className="gr-th-content">Grau <SortIcon active={sortBy === 'grade'} dir={sortDir} /></span>
                  </th>
                  <th className="gr-th-c t-label gr-th-sortable" onClick={() => handleSort('status')}>
                    <span className="gr-th-content">Estado <SortIcon active={sortBy === 'status'} dir={sortDir} /></span>
                  </th>
                  <th className="t-label gr-th-sortable" onClick={() => handleSort('mitigation')}>
                    <span className="gr-th-content">Mitigação <SortIcon active={sortBy === 'mitigation'} dir={sortDir} /></span>
                  </th>
                  <th className="gr-th-c t-label" />
                </tr>
              </thead>
              <tbody>
                {sortedRisks.map(r => {
                  const g  = calcGrau(r.impact, r.probability)
                  const gs = gradeStyle(g, matrixSize, thresholds)
                  return (
                    <tr
                      key={r.id}
                      className={`gr-row${selectedRiskIds.includes(r.id) ? ' is-selected' : ''}`}
                      onClick={() => handleSelectRisk([r.id])}
                      onDoubleClick={readOnly ? undefined : () => openEdit(r)}
                    >
                      <td className="gr-td-wrap" title={r.description}>
                        {r.description}
                      </td>
                      <td className="gr-td-c">{r.impact}</td>
                      <td className="gr-td-c">{r.probability}</td>
                      <td className="gr-td-c">
                        <span
                          className="gr-grau-badge"
                          style={{ background: gs.bg, color: gs.color, borderColor: gs.border }}
                          title={gradeLabel(g, matrixSize, thresholds)}
                        >
                          {gradeLabel(g, matrixSize, thresholds)}
                        </span>
                      </td>
                      <td className="gr-td-c">
                        <Badge variant={estadoBadge(r.status)}>{r.status}</Badge>
                      </td>
                      <td className="gr-td-wrap" title={r.mitigation}>
                        {r.mitigation || '—'}
                      </td>
                      <td className="gr-td-c">
                        {!readOnly && (
                          <RowMenu
                            riskId={r.id}
                            openId={menuId}
                            onOpen={setMenuId}
                            onEdit={() => openEdit(r)}
                            onDuplicate={() => openDuplicate(r)}
                            onDelete={() => handleRowDelete(r)}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </Card>

      {panelForm && (
        <Modal
          isOpen={true}
          onClose={closePanel}
          title={panelForm.id ? 'Editar Risco' : 'Novo Risco'}
          width={440}
          footer={
            <>
              {panelForm.id && (
                <button className="btn-danger" onClick={handlePanelDelete} disabled={panelSaving} style={{ marginRight: 'auto' }}>
                  Eliminar
                </button>
              )}
              <button className="btn" onClick={closePanel}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={panelSaving}>
                {panelSaving ? 'A guardar…' : 'Guardar'}
              </button>
              {panelErr && <span style={{ fontSize: 12, color: 'var(--red)', width: '100%' }}>{panelErr}</span>}
            </>
          }
        >
          <Panel form={panelForm} onChange={f => setPanelForm(f)} matrixSize={matrixSize} thresholds={thresholds} />
        </Modal>
      )}
    </div>
  )
}
