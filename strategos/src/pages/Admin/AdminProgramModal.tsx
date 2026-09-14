import './Admin.css'
import { useState } from 'react'
import Modal from '../../components/Modal/Modal'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { useGlobalBands } from '../../hooks/useThresholdsMap'
import { resolveBandDraft, type BandDraft } from '../../lib/thresholdValidation'
import type { ThresholdBand } from '../../lib/rollup'
import type { Program } from '../../types/index'

interface DraftProg {
  code: string
  name: string
  /** null = inherit from the app_config global. */
  threshold_leaves_low: number | null
  threshold_leaves_high: number | null
  threshold_aggregates_low: number | null
  threshold_aggregates_high: number | null
}

interface Props {
  program: Program | null
  programs: Program[]
  onClose: () => void
  onSaved: () => void
}

/** '' → null; otherwise the parsed number (NaN is caught by the validator). */
function parseField(raw: string): number | null {
  if (raw === '') return null
  return Number(raw)
}

export default function AdminProgramModal({ program, programs, onClose, onSaved }: Props) {
  const { showToast } = useToast()
  // A programa's parent tier is the app_config global.
  const { globalLeaves, globalAggregates } = useGlobalBands()

  const [draft, setDraft] = useState<DraftProg>(() => program ? {
    code: program.code,
    name: program.name,
    threshold_leaves_low:      program.threshold_leaves_low,
    threshold_leaves_high:     program.threshold_leaves_high,
    threshold_aggregates_low:  program.threshold_aggregates_low,
    threshold_aggregates_high: program.threshold_aggregates_high,
  } : {
    // A new programa inherits everything until the user overrides it.
    code: '', name: '',
    threshold_leaves_low: null, threshold_leaves_high: null,
    threshold_aggregates_low: null, threshold_aggregates_high: null,
  })
  const [saving, setSaving] = useState(false)

  function set(patch: Partial<DraftProg>) { setDraft(d => ({ ...d, ...patch })) }

  const aggDraft:  BandDraft = { low: draft.threshold_aggregates_low, high: draft.threshold_aggregates_high }
  const lvsDraft:  BandDraft = { low: draft.threshold_leaves_low,     high: draft.threshold_leaves_high }
  const aggResult = resolveBandDraft(aggDraft, globalAggregates)
  const lvsResult = resolveBandDraft(lvsDraft, globalLeaves)
  const blocked   = !!(aggResult.error || lvsResult.error)

  /** On blur, materialise the auto-completed half so the user sees what will be saved. */
  function completeAggregates() {
    const r = resolveBandDraft(aggDraft, globalAggregates)
    if (r.autoFilled) set({ threshold_aggregates_low: r.low, threshold_aggregates_high: r.high })
  }
  function completeLeaves() {
    const r = resolveBandDraft(lvsDraft, globalLeaves)
    if (r.autoFilled) set({ threshold_leaves_low: r.low, threshold_leaves_high: r.high })
  }

  async function handleSave() {
    if (!draft.name.trim() || blocked) return
    setSaving(true)
    try {
      const payload = {
        code: draft.code.trim(),
        name: draft.name.trim(),
        threshold_leaves_low:      lvsResult.low,
        threshold_leaves_high:     lvsResult.high,
        threshold_aggregates_low:  aggResult.low,
        threshold_aggregates_high: aggResult.high,
      }
      if (program) {
        await supabase.from('programs').update(payload).eq('id', program.id)
      } else {
        const sort_order = Math.max(0, ...programs.map(p => p.sort_order)) + 1
        await supabase.from('programs').insert({ ...payload, sort_order })
      }
      showToast('Guardado!', 'success')
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <>
      <button className="adm-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
      <button
        className="btn-primary"
        onClick={handleSave}
        disabled={saving || !draft.name.trim() || blocked}
      >
        {saving ? 'A guardar…' : 'Guardar'}
      </button>
    </>
  )

  function bandInputs(
    label: string,
    inherited: ThresholdBand,
    lowValue: number | null,
    highValue: number | null,
    onLow: (v: number | null) => void,
    onHigh: (v: number | null) => void,
    onBlurBand: () => void,
    error: string | null,
  ) {
    return (
      <div>
        <div className="threshold-pair">
          <div className="adm-field">
            <label className="adm-label">{label} — Low</label>
            <input
              className={`adm-input threshold-input-low${error ? ' adm-input-error' : ''}`}
              type="number" min={0} max={100}
              value={lowValue ?? ''}
              placeholder={`padrão: ${inherited.low}`}
              onChange={e => onLow(parseField(e.target.value))}
              onBlur={onBlurBand}
            />
          </div>
          <div className="adm-field">
            <label className="adm-label">{label} — High</label>
            <input
              className={`adm-input threshold-input-high${error ? ' adm-input-error' : ''}`}
              type="number" min={0} max={100}
              value={highValue ?? ''}
              placeholder={`padrão: ${inherited.high}`}
              onChange={e => onHigh(parseField(e.target.value))}
              onBlur={onBlurBand}
            />
          </div>
        </div>
        {error && (
          <p style={{ fontSize: 12, color: 'var(--red)', margin: '4px 0 0' }}>{error}</p>
        )}
      </div>
    )
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={program ? `Editar Programa: ${program.name}` : 'Novo Programa'}
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="adm-field" style={{ flex: '0 0 100px' }}>
            <label className="adm-label">Código</label>
            <input
              className="adm-input adm-input-uppercase"
              autoFocus
              value={draft.code}
              onChange={e => set({ code: e.target.value })}
            />
          </div>
          <div className="adm-field" style={{ flex: 1 }}>
            <label className="adm-label">Nome</label>
            <input
              className="adm-input"
              value={draft.name}
              onChange={e => set({ name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') void handleSave() }}
            />
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text2)', margin: 0 }}>
          Margem em pontos percentuais. Vazio = herdar do valor global; se preencher apenas um dos limites, o outro é preenchido com o valor herdado. Low = limite entre «Em dia» e «Em risco»; High = limite entre «Em risco» e «Em atraso».
        </p>

        {bandInputs(
          'Plano e Macroact. (N2-N3)',
          globalAggregates,
          draft.threshold_aggregates_low,
          draft.threshold_aggregates_high,
          v => set({ threshold_aggregates_low: v }),
          v => set({ threshold_aggregates_high: v }),
          completeAggregates,
          aggResult.error,
        )}

        {bandInputs(
          'Actividades (N4-N6)',
          globalLeaves,
          draft.threshold_leaves_low,
          draft.threshold_leaves_high,
          v => set({ threshold_leaves_low: v }),
          v => set({ threshold_leaves_high: v }),
          completeLeaves,
          lvsResult.error,
        )}
      </div>
    </Modal>
  )
}
