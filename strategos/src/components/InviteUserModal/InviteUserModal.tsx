import './InviteUserModal.css'
import { useState, useCallback } from 'react'
import Modal from '../Modal/Modal'
import UserPermissionsForm, { type PermRow } from '../UserPermissionsForm/UserPermissionsForm'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'

type InviteRole = 'program_manager' | 'editor' | 'sponsor' | 'stakeholder'

interface InviteUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function InviteUserModal({ open, onClose, onSuccess }: InviteUserModalProps) {
  const { showToast } = useToast()
  const [email,       setEmail]       = useState('')
  const [fullName,    setFullName]    = useState('')
  const [role,        setRole]        = useState<InviteRole>('stakeholder')
  const [submitting,  setSubmitting]  = useState(false)
  const [currentPerms, setCurrentPerms] = useState<PermRow[]>([])

  const handlePermsChange = useCallback((rows: PermRow[]) => {
    setCurrentPerms(rows)
  }, [])

  function handleClose() {
    setEmail('')
    setFullName('')
    setRole('stakeholder')
    setCurrentPerms([])
    onClose()
  }

  async function handleSubmit() {
    if (!email.trim()) {
      showToast('Email obrigatório', 'error')
      return
    }
    if (!email.includes('@')) {
      showToast('Email inválido', 'error')
      return
    }

    setSubmitting(true)
    try {
      const permissions = currentPerms
        .filter(r => r.program_id !== null)
        .map(r => ({
          programId:   r.program_id as string,
          planId:      r.plan_id,
          page:        r.page,
          accessLevel: r.access_level,
        }))

      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email:       email.trim(),
          role,
          fullName:    fullName.trim() || undefined,
          permissions,
        },
      })

      if (data?.error) throw new Error(data.error as string)
      if (error) throw error

      showToast('Convite enviado.', 'success')
      onSuccess?.()
      handleClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro a enviar convite'
      showToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title="Convidar utilizador"
      width={560}
      footer={
        <>
          <button className="btn" onClick={handleClose} disabled={submitting}>Cancelar</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting || !email.trim()}>
            {submitting ? 'A enviar…' : 'Enviar convite'}
          </button>
        </>
      }
    >
      <div className="ium-body">
        {/* ── Identity fields ── */}
        <div className="ium-fields">
          <div className="ium-field">
            <label className="ium-label" htmlFor="ium-email">Email *</label>
            <input
              id="ium-email"
              className="ium-input"
              type="email"
              autoFocus
              autoComplete="off"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleSubmit() }}
              placeholder="utilizador@org.pt"
            />
          </div>
          <div className="ium-field">
            <label className="ium-label" htmlFor="ium-name">Nome</label>
            <input
              id="ium-name"
              className="ium-input"
              type="text"
              autoComplete="off"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Nome completo (opcional)"
            />
          </div>
          <div className="ium-field">
            <label className="ium-label" htmlFor="ium-role">Role *</label>
            <select
              id="ium-role"
              className="ium-select"
              value={role}
              onChange={e => setRole(e.target.value as InviteRole)}
            >
              <option value="program_manager">Program Manager — gere programas, pode editar</option>
              <option value="editor">Gestor — edita conforme permissões</option>
              <option value="sponsor">Sponsor — apenas visualização</option>
              <option value="stakeholder">Stakeholder — apenas visualização</option>
            </select>
          </div>
        </div>

        {/* ── Permissions ── */}
        <div className="ium-perms-section">
          <hr className="ium-divider" />
          <p className="ium-perms-heading">Permissões</p>
          <UserPermissionsForm
            userId={null}
            userRole={role}
            onChange={handlePermsChange}
          />
        </div>
      </div>
    </Modal>
  )
}
