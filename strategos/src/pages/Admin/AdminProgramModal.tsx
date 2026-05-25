import './Admin.css'
import { useState } from 'react'
import Modal from '../../components/Modal/Modal'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import type { Program } from '../../types/index'

interface DraftProg {
  code: string
  name: string
  threshold_leaves_low: number
  threshold_leaves_high: number
  threshold_aggregates_low: number
  threshold_aggregates_high: number
}

function validateThresholds(d: DraftProg): string | null {
  if (d.threshold_leaves_low < 0 || d.threshold_leaves_low > 100) return 'Actividades Low deve ser 0–100'
  if (d.threshold_leaves_high < 0 || d.threshold_leaves_high > 100) return 'Actividades High deve ser 0–100'
  if (d.threshold_leaves_high < d.threshold_leaves_low) return 'Actividades High deve ser ≥ Low'
  if (d.threshold_aggregates_low < 0 || d.threshold_aggregates_low > 100) return 'Plano Low deve ser 0–100'
  if (d.threshold_aggregates_high < 0 || d.threshold_aggregates_high > 100) return 'Plano High deve ser 0–100'
  if (d.threshold_aggregates_high < d.threshold_aggregates_low) return 'Plano High deve ser ≥ Low'
  return null
}

interface Props {
  program: Program | null
  programs: Program[]
  onClose: () => void
  onSaved: () => void
}

export default function AdminProgramModal({ program, programs, onClose, onSaved }: Props) {
  const { showToast } = useToast()
  const [draft, setDraft] = useState<DraftProg>(() => program ? {
    code: program.code,
    name: program.name,
    threshold_leaves_low:      program.threshold_leaves_low  ?? 5,
    threshold_leaves_high:     program.threshold_leaves_high ?? 10,
    threshold_aggregates_low:  program.threshold_aggregates_low  ?? 15,
    threshold_aggregates_high: program.threshold_aggregates_high ?? 25,
  } : {
    code: '', name: '',
    threshold_leaves_low: 5, threshold_leaves_high: 10,
    threshold_aggregates_low: 15, threshold_aggregates_high: 25,
  })
  const [saving, setSaving] = useState(false)

  const errMsg = validateThresholds(draft)

  function set(patch: Partial<DraftProg>) { setDraft(d => ({ ...d, ...patch })) }

  async function handleSave() {
    if (!draft.name.trim() || errMsg) return
    setSaving(true)
    try {
      const payload = {
        code: draft.code.trim(),
        name: draft.name.trim(),
        threshold_leaves_low:      draft.threshold_leaves_low,
        threshold_leaves_high:     draft.threshold_leaves_high,
        threshold_aggregates_low:  draft.threshold_aggregates_low,
        threshold_aggregates_high: draft.threshold_aggregates_high,
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
        disabled={saving || !draft.name.trim() || !!errMsg}
      >
        {saving ? 'A guardar…' : 'Guardar'}
      </button>
    </>
  )

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

        <div className="threshold-pair">
          <div className="adm-field">
            <label className="adm-label">Actividades (N4-N6) — Low</label>
            <input
              className={`adm-input threshold-input-low${errMsg && (draft.threshold_leaves_low < 0 || draft.threshold_leaves_low > 100 || draft.threshold_leaves_high < draft.threshold_leaves_low) ? ' adm-input-error' : ''}`}
              type="number" min={0} max={100}
              value={draft.threshold_leaves_low}
              onChange={e => set({ threshold_leaves_low: Number(e.target.value) })}
            />
          </div>
          <div className="adm-field">
            <label className="adm-label">Actividades (N4-N6) — High</label>
            <input
              className={`adm-input threshold-input-high${errMsg && (draft.threshold_leaves_high < 0 || draft.threshold_leaves_high > 100 || draft.threshold_leaves_high < draft.threshold_leaves_low) ? ' adm-input-error' : ''}`}
              type="number" min={0} max={100}
              value={draft.threshold_leaves_high}
              onChange={e => set({ threshold_leaves_high: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="threshold-pair">
          <div className="adm-field">
            <label className="adm-label">Plano e Macroact. (N2-N3) — Low</label>
            <input
              className={`adm-input threshold-input-low${errMsg && (draft.threshold_aggregates_low < 0 || draft.threshold_aggregates_low > 100 || draft.threshold_aggregates_high < draft.threshold_aggregates_low) ? ' adm-input-error' : ''}`}
              type="number" min={0} max={100}
              value={draft.threshold_aggregates_low}
              onChange={e => set({ threshold_aggregates_low: Number(e.target.value) })}
            />
          </div>
          <div className="adm-field">
            <label className="adm-label">Plano e Macroact. (N2-N3) — High</label>
            <input
              className={`adm-input threshold-input-high${errMsg && (draft.threshold_aggregates_high < 0 || draft.threshold_aggregates_high > 100 || draft.threshold_aggregates_high < draft.threshold_aggregates_low) ? ' adm-input-error' : ''}`}
              type="number" min={0} max={100}
              value={draft.threshold_aggregates_high}
              onChange={e => set({ threshold_aggregates_high: Number(e.target.value) })}
            />
          </div>
        </div>

        {errMsg && (
          <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>{errMsg}</p>
        )}
      </div>
    </Modal>
  )
}
