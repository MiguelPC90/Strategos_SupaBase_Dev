import './Admin.css'
import { useState } from 'react'
import Modal from '../../components/Modal/Modal'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import type { Eixo, Program } from '../../types/index'

interface Props {
  eixo: Eixo | null
  program: Program
  eixos: Eixo[]
  onClose: () => void
  onSaved: () => void
}

export default function AdminEixoModal({ eixo, program, eixos, onClose, onSaved }: Props) {
  const { showToast } = useToast()
  const [code, setCode] = useState(eixo?.code ?? '')
  const [name, setName] = useState(eixo?.name ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const payload = { program_id: program.id, code: code.trim(), name: name.trim() }
      if (eixo) {
        await supabase.from('eixos').update(payload).eq('id', eixo.id)
      } else {
        const progEixos = eixos.filter(e => e.program_id === program.id)
        const sort_order = Math.max(0, ...progEixos.map(e => e.sort_order)) + 1
        await supabase.from('eixos').insert({ ...payload, sort_order })
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
        disabled={saving || !name.trim()}
      >
        {saving ? 'A guardar…' : 'Guardar'}
      </button>
    </>
  )

  const title = eixo
    ? `Editar Eixo · ${program.name}`
    : `Novo Eixo · ${program.name}`

  return (
    <Modal isOpen onClose={onClose} title={title} footer={footer}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="adm-field" style={{ flex: '0 0 100px' }}>
          <label className="adm-label">Código</label>
          <input
            className="adm-input adm-input-uppercase"
            autoFocus
            value={code}
            onChange={e => setCode(e.target.value)}
          />
        </div>
        <div className="adm-field" style={{ flex: 1 }}>
          <label className="adm-label">Nome</label>
          <input
            className="adm-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSave() }}
          />
        </div>
      </div>
    </Modal>
  )
}
