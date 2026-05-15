import './SetupPassword.css'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { useBranding } from '../../context/BrandingContext'
import StratgosWordmark from '../../components/Brand/StratgosWordmark'

export default function SetupPassword() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { mode, clientLogoUrl, clientTitle } = useBranding()

  const [password,      setPassword]      = useState('')
  const [confirm,       setConfirm]       = useState('')
  const [saving,        setSaving]        = useState(false)
  const [sessionReady,  setSessionReady]  = useState(false)
  const [userEmail,     setUserEmail]     = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        showToast('Sessão inválida. Pede um novo convite ao administrador.', 'error')
        navigate('/login')
        return
      }
      setUserEmail(session.user.email ?? null)
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
      showToast('Palavra-passe definida. Bem-vindo.', 'success')
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao definir palavra-passe'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sp-page">
      <div className="sp-content">
        {/* Brand area */}
        <div className="sp-brand-area">
          <StratgosWordmark size={48} onDark={false} />
          {mode === 'cobrand' && clientLogoUrl && (
            <>
              <span className="sp-brand-x" aria-hidden="true">x</span>
              <img
                src={clientLogoUrl}
                alt={clientTitle || 'Cliente'}
                className="sp-brand-client-logo"
              />
            </>
          )}
        </div>

        <div className="sp-card">
          <h1 className="sp-heading t-title">Bem-vindo ao Stratgos</h1>

          {sessionReady && (
            <>
              {userEmail && (
                <p className="sp-subtitle">
                  Conta criada para <strong>{userEmail}</strong>. Define a tua palavra-passe para começar.
                </p>
              )}

              <form
                className="sp-form"
                onSubmit={e => { e.preventDefault(); void handleSave() }}
                noValidate
              >
                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-password">Nova palavra-passe</label>
                  <input
                    id="sp-password"
                    className="sp-input"
                    type="password"
                    autoFocus
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    disabled={saving}
                  />
                </div>
                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-confirm">Confirmar palavra-passe</label>
                  <input
                    id="sp-confirm"
                    className="sp-input"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repetir palavra-passe"
                    disabled={saving}
                  />
                </div>
                <button className="btn-primary sp-submit" type="submit" disabled={saving}>
                  {saving ? <span className="sp-spinner" /> : 'Definir palavra-passe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
