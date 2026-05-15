import './ResetPassword.css'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { useBranding } from '../../context/BrandingContext'
import StratgosWordmark from '../../components/Brand/StratgosWordmark'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { mode, clientLogoUrl, clientTitle } = useBranding()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        showToast('Sessão inválida. Pede um novo link.', 'error')
        navigate('/login')
        return
      }
      setSessionReady(true)
    })
  }, [navigate, showToast])

  async function handleSave() {
    if (password.length < 8) {
      showToast('Palavra-passe deve ter pelo menos 8 caracteres', 'error')
      return
    }
    if (password !== confirm) {
      showToast('As palavras-passe não coincidem', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      showToast('Palavra-passe actualizada', 'success')
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao actualizar'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rp-page">
      <div className="rp-content">
        {/* Brand area */}
        <div className="rp-brand-area">
          <StratgosWordmark size={48} onDark={false} />
          {mode === 'cobrand' && clientLogoUrl && (
            <>
              <span className="rp-brand-x" aria-hidden="true">x</span>
              <img
                src={clientLogoUrl}
                alt={clientTitle || 'Cliente'}
                className="rp-brand-client-logo"
              />
            </>
          )}
        </div>

        <div className="rp-card">
          <h1 className="rp-heading t-title">Define a tua nova palavra-passe</h1>

          {sessionReady && (
            <form
              className="rp-form"
              onSubmit={e => { e.preventDefault(); void handleSave() }}
              noValidate
            >
              <div className="rp-field">
                <label className="rp-label" htmlFor="rp-password">Nova palavra-passe</label>
                <input
                  id="rp-password"
                  className="rp-input"
                  type="password"
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div className="rp-field">
                <label className="rp-label" htmlFor="rp-confirm">Confirmar palavra-passe</label>
                <input
                  id="rp-confirm"
                  className="rp-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repetir palavra-passe"
                />
              </div>
              <button className="btn-primary rp-submit" type="submit" disabled={saving}>
                {saving ? <span className="rp-spinner" /> : 'Guardar palavra-passe'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
