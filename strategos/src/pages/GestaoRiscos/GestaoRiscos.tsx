import './GestaoRiscos.css'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import { useRisks } from '../../hooks/useRisks'
import { usePlanos } from '../../hooks/usePlanos'
import { useFilters } from '../../context/FilterContext'
import { supabase } from '../../lib/supabase'
import type { Risk } from '../../types/index'

// ── Types ──────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'blue' | 'red' | 'amber' | 'grey' | 'navy'

interface PlanOption {
  key:        string
  label:      string
  n0:         string
  n1:         string
  n2:         string
  id0:        string
  id1:        string
  id2:        string
  program_id: string | null
}

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

function grauLabel(g: number): string {
  if (g <= 4)  return 'Baixo'
  if (g <= 9)  return 'Médio'
  if (g <= 16) return 'Alto'
  return 'Crítico'
}

function grauCls(g: number): string {
  if (g <= 4)  return 'gr-grau-baixo'
  if (g <= 9)  return 'gr-grau-medio'
  if (g <= 16) return 'gr-grau-alto'
  return 'gr-grau-crit'
}

const ESTADO_BADGE: Record<string, BadgeVariant> = {
  'Aberto':        'red',
  'Em mitigação':  'amber',
  'Mitigado':      'blue',
  'Fechado':       'green',
}
function estadoBadge(s: string): BadgeVariant {
  return ESTADO_BADGE[s] ?? 'grey'
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
  form:      RiskForm
  onChange:  (f: RiskForm) => void
  onSave:    () => void
  onDelete:  () => void
  onClose:   () => void
  saving:    boolean
  error:     string
}

function Panel({ form, onChange, onSave, onDelete, onClose, saving, error }: PanelProps) {
  const set =
    (k: keyof RiskForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ ...form, [k]: e.target.value } as RiskForm)

  const grauVal = calcGrau(Number(form.impact), Number(form.probability))

  return (
    <>
      <div className="gr-panel-overlay" onClick={onClose} />
      <div className="gr-panel">
        <div className="gr-panel-header">
          <span className="gr-panel-title">
            {form.id ? 'Editar Risco' : 'Novo Risco'}
          </span>
          <button className="gr-btn" onClick={onClose}>✕</button>
        </div>

        <div className="gr-panel-body">
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
              <select className="gr-field-select" value={form.impact} onChange={set('impact')}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="gr-field">
              <span className="gr-field-label">Probabilidade *</span>
              <select className="gr-field-select" value={form.probability} onChange={set('probability')}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="gr-field">
            <span className="gr-field-label">Grau de Risco</span>
            <div className="gr-grau-display">
              <span className="gr-grau-num">{grauVal}</span>
              <span className={`gr-grau-badge ${grauCls(grauVal)}`}>
                {grauLabel(grauVal)}
              </span>
            </div>
          </div>

          <div className="gr-field">
            <span className="gr-field-label">Estado *</span>
            <select className="gr-field-select" value={form.status} onChange={set('status')}>
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

        <div className="gr-panel-footer">
          <button
            className="gr-btn gr-btn-primary"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
          <button className="gr-btn" onClick={onClose}>Cancelar</button>
          {form.id && (
            <button
              className="gr-btn gr-btn-danger"
              onClick={onDelete}
              disabled={saving}
              style={{ marginLeft: 'auto' }}
            >
              Eliminar
            </button>
          )}
          {error && <span className="gr-panel-err">{error}</span>}
        </div>
      </div>
    </>
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
      <button ref={btnRef} className="gr-icon-btn" onClick={handleClick} title="Acções">
        ⋯
      </button>
      {open && pos !== null && createPortal(menu, document.body)}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function GestaoRiscos() {
  const { filters }  = useFilters()
  const programId    = filters.programIds[0] as string | undefined

  const { planos, loading: planosLoading } = usePlanos(programId)
  const { risks, loading: risksLoading, refetch } = useRisks(programId)
  const loading = risksLoading || planosLoading

  // ── Plan options from planos table ──────────────────────────
  const planOptions = useMemo<PlanOption[]>(() =>
    planos.map(p => {
      const eixoName = p.eixo?.name ?? ''
      return {
        key:        p.id,
        label:      eixoName ? `${eixoName} › ${p.name}` : p.name,
        n0:         '',
        n1:         eixoName,
        n2:         p.name,
        id0:        '',
        id1:        p.eixo?.code ?? '',
        id2:        p.code,
        program_id: p.program_id,
      }
    }),
    [planos]
  )

  const [selectedKey, setSelectedKey] = useState<string>('')

  // Reset plan when program changes
  useEffect(() => { setSelectedKey('') }, [programId])

  // Auto-select first plan
  useEffect(() => {
    if (!selectedKey && planOptions.length > 0) {
      setSelectedKey(planOptions[0].key)
    }
  }, [planOptions, selectedKey])

  const selectedPlan = useMemo(
    () => planOptions.find(p => p.key === selectedKey) ?? null,
    [planOptions, selectedKey],
  )

  // Filter risks for selected plan via pds_id (= plan's id2)
  const planRisks = useMemo<Risk[]>(() => {
    if (!selectedPlan) return []
    return risks.filter(r => r.pds_id === selectedPlan.id2)
  }, [risks, selectedPlan])

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

  // ── Toast ────────────────────────────────────────────────────
  const [toast, setToast] = useState('')
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

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
    if (!panelForm || !selectedPlan) return
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
          pds_id:     selectedPlan.id2,
          program_id: selectedPlan.program_id,
          sort_order: planRisks.length,
        })
      if (error) errMsg = error.message
    }

    setPanelSaving(false)
    if (errMsg) { setPanelErr(errMsg); return }
    setPanelForm(null)
    setToast('Guardado!')
    refetch()
  }, [panelForm, selectedPlan, planRisks.length, refetch])

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
    setToast('Eliminado.')
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
    setToast('Eliminado.')
    refetch()
  }, [refetch])

  // ── Derived flags ─────────────────────────────────────────────
  const noProgram = !programId
  const noPlans   = !noProgram && !planosLoading && planOptions.length === 0

  return (
    <div className="gr-page">
      {/* Controls bar */}
      <div className="gr-controls-bar">
        <label className="gr-label">Plano de Acção:</label>
        <select
          className="gr-plan-select"
          value={selectedKey}
          onChange={e => setSelectedKey(e.target.value)}
          disabled={noProgram || noPlans}
        >
          {noProgram ? (
            <option value="">— selecciona um programa —</option>
          ) : noPlans ? (
            <option value="">— sem planos disponíveis —</option>
          ) : (
            planOptions.map(p => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))
          )}
        </select>

        <div className="gr-spacer" />

        {toast && <span className="gr-toast">{toast}</span>}

        <button
          className="gr-btn gr-btn-primary"
          onClick={openNew}
          disabled={!selectedPlan}
        >
          Novo Risco
        </button>
      </div>

      {/* Risk table */}
      <Card title="Riscos">
        {loading ? (
          <div className="gr-empty">A carregar…</div>
        ) : noProgram ? (
          <div className="gr-empty">
            Selecciona um programa para gerir riscos.
          </div>
        ) : noPlans ? (
          <div className="gr-empty">
            Nenhum plano de acção disponível para este programa.
          </div>
        ) : !selectedPlan ? (
          <div className="gr-empty">
            Seleccione um plano para gerir riscos.
          </div>
        ) : planRisks.length === 0 ? (
          <div className="gr-empty">
            <div>Sem riscos registados para este plano.</div>
            <button
              className="gr-btn gr-btn-primary"
              style={{ marginTop: 12 }}
              onClick={openNew}
            >
              + Novo Risco
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="gr-table">
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
                  <th>Descrição</th>
                  <th className="gr-th-c">Impacto</th>
                  <th className="gr-th-c">Probabilidade</th>
                  <th className="gr-th-c">Grau</th>
                  <th className="gr-th-c">Estado</th>
                  <th>Mitigação</th>
                  <th className="gr-th-c" />
                </tr>
              </thead>
              <tbody>
                {planRisks.map(r => {
                  const g = calcGrau(r.impact, r.probability)
                  return (
                    <tr
                      key={r.id}
                      className="gr-row"
                      onDoubleClick={() => openEdit(r)}
                    >
                      <td className="gr-td-wrap" title={r.description}>
                        {r.description}
                      </td>
                      <td className="gr-td-c">{r.impact}</td>
                      <td className="gr-td-c">{r.probability}</td>
                      <td className="gr-td-c">
                        <span className={`gr-grau-badge ${grauCls(g)}`}>
                          {grauLabel(g)}
                        </span>
                      </td>
                      <td className="gr-td-c">
                        <Badge variant={estadoBadge(r.status)}>{r.status}</Badge>
                      </td>
                      <td className="gr-td-wrap" title={r.mitigation}>
                        {r.mitigation || '—'}
                      </td>
                      <td className="gr-td-c">
                        <RowMenu
                          riskId={r.id}
                          openId={menuId}
                          onOpen={setMenuId}
                          onEdit={() => openEdit(r)}
                          onDuplicate={() => openDuplicate(r)}
                          onDelete={() => handleRowDelete(r)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Side panel */}
      {panelForm && (
        <Panel
          form={panelForm}
          onChange={f => setPanelForm(f)}
          onSave={handleSave}
          onDelete={handlePanelDelete}
          onClose={closePanel}
          saving={panelSaving}
          error={panelErr}
        />
      )}
    </div>
  )
}
