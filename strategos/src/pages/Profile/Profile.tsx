import './Profile.css'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useRole } from '../../hooks/useRole'
import { useProfile } from '../../context/ProfileContext'
import Badge from '../../components/Badge/Badge'

const ROLE_LABEL: Record<string, string> = {
  admin:           'Admin',
  program_manager: 'Prog. Manager',
  editor:          'Gestor',
  sponsor:         'Sponsor',
  stakeholder:     'Stakeholder',
  viewer:          'Visualizador',
}

function roleBadgeVariant(role: string | null): 'navy' | 'blue' | 'amber' | 'grey' {
  if (role === 'admin') return 'navy'
  if (role === 'editor' || role === 'program_manager') return 'blue'
  if (role === 'sponsor') return 'amber'
  return 'grey'
}

function getInitials(fullName: string, email: string): string {
  if (fullName.trim()) {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return fullName.slice(0, 2).toUpperCase()
  }
  return email.split('@')[0].slice(0, 2).toUpperCase()
}

export default function Profile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile, role } = useRole()
  const { refresh: refreshProfile } = useProfile()

  // Identity state
  const [fullName, setFullName] = useState('')
  const [originalFullName, setOriginalFullName] = useState('')
  const [identitySaving, setIdentitySaving] = useState(false)
  const [identityFeedback, setIdentityFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdFeedback, setPwdFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    if (profile) {
      const name = profile.full_name ?? ''
      setFullName(name)
      setOriginalFullName(name)
    }
  }, [user, profile, navigate])

  const email = user?.email ?? ''
  const initials = getInitials(fullName, email)
  const roleLabel = role ? (ROLE_LABEL[role] ?? role) : null
  const identityUnchanged = fullName === originalFullName

  async function handleIdentitySave() {
    if (!user) return
    setIdentitySaving(true)
    setIdentityFeedback(null)

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id)

    setIdentitySaving(false)
    if (error) {
      setIdentityFeedback({ type: 'error', msg: 'Erro ao guardar: ' + error.message })
    } else {
      setOriginalFullName(fullName)
      await refreshProfile()
      setIdentityFeedback({ type: 'success', msg: 'Guardado.' })
      setTimeout(() => setIdentityFeedback(null), 3000)
    }
  }

  async function handlePasswordChange() {
    if (!user || !email) return
    setPwdFeedback(null)

    if (!currentPassword) {
      setPwdFeedback({ type: 'error', msg: 'Introduz a palavra-passe atual.' })
      return
    }
    if (newPassword.length < 6) {
      setPwdFeedback({ type: 'error', msg: 'A nova palavra-passe deve ter pelo menos 6 caracteres.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdFeedback({ type: 'error', msg: 'As palavras-passe não coincidem.' })
      return
    }

    setPwdSaving(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (authError) {
      setPwdSaving(false)
      setPwdFeedback({ type: 'error', msg: 'Palavra-passe atual incorreta.' })
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setPwdSaving(false)
    if (updateError) {
      setPwdFeedback({ type: 'error', msg: 'Erro ao alterar: ' + updateError.message })
    } else {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwdFeedback({ type: 'success', msg: 'Palavra-passe alterada.' })
      setTimeout(() => setPwdFeedback(null), 3000)
    }
  }

  return (
    <div className="profile-page">
      {/* Identity card */}
      <div className="profile-card">
        <div className="profile-card-title">Perfil</div>

        <div className="profile-avatar">{initials}</div>

        <div className="profile-field">
          <label className="profile-label">Nome completo</label>
          <input
            className="profile-input"
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Nome completo"
          />
        </div>

        <div className="profile-field">
          <label className="profile-label">Email</label>
          <input
            className="profile-input"
            type="email"
            value={email}
            readOnly
          />
        </div>

        {roleLabel && (
          <div className="profile-field">
            <label className="profile-label">Função</label>
            <div className="profile-role-row">
              <Badge variant={roleBadgeVariant(role)}>{roleLabel}</Badge>
            </div>
          </div>
        )}

        <div className="profile-actions">
          <button
            className="profile-btn-primary"
            onClick={handleIdentitySave}
            disabled={identityUnchanged || identitySaving}
          >
            {identitySaving ? 'A guardar…' : 'Guardar'}
          </button>
          {identityFeedback && (
            <span className={`profile-feedback profile-feedback--${identityFeedback.type}`}>
              {identityFeedback.msg}
            </span>
          )}
        </div>
      </div>

      {/* Password card */}
      <div className="profile-card">
        <div className="profile-card-title">Alterar palavra-passe</div>

        <div className="profile-pwd-grid">
          <div className="profile-field">
            <label className="profile-label">Palavra-passe atual</label>
            <input
              className="profile-input"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="profile-field">
            <label className="profile-label">Nova palavra-passe</label>
            <input
              className="profile-input"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="profile-field">
            <label className="profile-label">Confirmar nova palavra-passe</label>
            <input
              className="profile-input"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="profile-actions">
          <button
            className="profile-btn-primary"
            onClick={handlePasswordChange}
            disabled={pwdSaving || !currentPassword || !newPassword || !confirmPassword}
          >
            {pwdSaving ? 'A alterar…' : 'Alterar palavra-passe'}
          </button>
          {pwdFeedback && (
            <span className={`profile-feedback profile-feedback--${pwdFeedback.type}`}>
              {pwdFeedback.msg}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
