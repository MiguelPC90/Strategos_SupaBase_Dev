import './EditUserModal.css'
import { useState, useEffect } from 'react'
import Modal from '../Modal/Modal'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import type { Profile, UserRole } from '../../types/index'

interface EditUserModalProps {
  open: boolean
  user: Profile
  onClose: () => void
  onSaved: () => void
}

export default function EditUserModal({ open, user, onClose, onSaved }: EditUserModalProps) {
  const { showToast } = useToast()
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [email,    setEmail]    = useState(user.email ?? '')
  const [role,     setRole]     = useState<UserRole>(user.role)
  const [saving,   setSaving]   = useState(false)
  const [confirmEmailChange, setConfirmEmailChange] = useState(false)
  const [downgradeConfirm,   setDowngradeConfirm]   = useState<{ editCount: number } | null>(null)

  useEffect(() => {
    if (open) {
      setFullName(user.full_name ?? '')
      setEmail(user.email ?? '')
      setRole(user.role)
      setSaving(false)
      setConfirmEmailChange(false)
      setDowngradeConfirm(null)
    }
  }, [open, user])

  const emailChanged = email.trim() !== (user.email ?? '').trim()
  const nameChanged  = fullName.trim() !== (user.full_name ?? '').trim()
  const roleChanged  = role !== user.role
  const hasChanges   = emailChanged || nameChanged || roleChanged

  async function handleSaveClick() {
    if (!hasChanges) { onClose(); return }
    if (!email.trim() || !email.includes('@')) {
      showToast('Email inválido', 'error'); return
    }
    if (emailChanged) {
      setConfirmEmailChange(true)
      return
    }
    await checkDowngradeOrSave()
  }

  async function checkDowngradeOrSave() {
    if (roleChanged) {
      const viewOnlyRoles: UserRole[]   = ['sponsor', 'stakeholder']
      const editCapableRoles: UserRole[] = ['program_manager', 'editor']
      if (viewOnlyRoles.includes(role) && editCapableRoles.includes(user.role)) {
        setSaving(true)
        const { data } = await supabase
          .from('user_permissions')
          .select('id')
          .eq('user_id', user.id)
          .in('access_level', ['full', 'ops'])
        setSaving(false)
        const editCount = data?.length ?? 0
        if (editCount > 0) {
          setConfirmEmailChange(false)
          setDowngradeConfirm({ editCount })
          return
        }
      }
    }
    await doSave()
  }

  async function doSave(downgrade = false) {
    setSaving(true)
    try {
      if (downgrade) {
        await supabase
          .from('user_permissions')
          .update({ access_level: 'view' })
          .eq('user_id', user.id)
          .in('access_level', ['full', 'ops'])
      }
      if (emailChanged) {
        const { data, error } = await supabase.functions.invoke('update-user-email', {
          body: { userId: user.id, newEmail: email.trim() },
        })
        if (data?.error) throw new Error(data.error as string)
        if (error) throw error
      }
      if (nameChanged || roleChanged) {
        const updates: Record<string, unknown> = {}
        if (nameChanged) updates.full_name = fullName.trim() || null
        if (roleChanged) updates.role = role
        const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
        if (error) throw error
      }
      showToast('Utilizador actualizado.', 'success')
      onSaved()
      onClose()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao actualizar utilizador', 'error')
    } finally {
      setSaving(false)
      setConfirmEmailChange(false)
      setDowngradeConfirm(null)
    }
  }

  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        title="Editar utilizador"
        width={440}
        footer={
          <>
            <button className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
            <button
              className="btn-primary"
              onClick={() => { void handleSaveClick() }}
              disabled={saving || !hasChanges}
            >
              {saving ? 'A guardar…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="eum-body">
          <div className="eum-field">
            <label className="eum-label">Nome</label>
            <input
              className="eum-input"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="(opcional)"
              disabled={saving}
            />
          </div>
          <div className="eum-field">
            <label className="eum-label">Email</label>
            <input
              className="eum-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={saving}
            />
            {emailChanged && (
              <p className="eum-hint eum-hint-warn">
                O email será actualizado em auth, perfil e (se aplicável) catálogo de pessoas.
              </p>
            )}
          </div>
          <div className="eum-field">
            <label className="eum-label">Role</label>
            <select
              className="styled-select-sm"
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              disabled={saving}
            >
              <option value="admin">Admin</option>
              <option value="program_manager">Program Manager</option>
              <option value="editor">Gestor</option>
              <option value="sponsor">Sponsor</option>
              <option value="stakeholder">Stakeholder</option>
            </select>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmEmailChange}
        title="Alterar email"
        message={`Alterar o email de "${user.email ?? ''}" para "${email.trim()}"? Esta acção actualiza auth, perfil e (se aplicável) o catálogo de pessoas.`}
        confirmLabel="Alterar email"
        loading={saving}
        onConfirm={() => { void checkDowngradeOrSave() }}
        onCancel={() => setConfirmEmailChange(false)}
      />

      <ConfirmModal
        open={downgradeConfirm !== null}
        title="Mudar para role de visualização"
        message={`Este utilizador tem ${downgradeConfirm?.editCount ?? 0} permissões de edição. Ao mudar de role, estas permissões serão convertidas para apenas visualização.`}
        confirmLabel="Continuar"
        loading={saving}
        onConfirm={() => { void doSave(true) }}
        onCancel={() => setDowngradeConfirm(null)}
      />
    </>
  )
}
