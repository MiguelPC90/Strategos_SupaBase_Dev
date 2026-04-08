import './Login.css'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

type Tab = 'password' | 'magic'

export default function Login() {
  const { signIn, signInWithMagicLink } = useAuth()

  const [tab, setTab] = useState<Tab>('password')

  // Email + password state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Magic link state
  const [mlEmail, setMlEmail] = useState('')
  const [mlError, setMlError] = useState('')
  const [mlLoading, setMlLoading] = useState(false)
  const [mlSent, setMlSent] = useState(false)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) setError(err.message)
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setMlError('')
    setMlLoading(true)
    const { error: err } = await signInWithMagicLink(mlEmail)
    setMlLoading(false)
    if (err) {
      setMlError(err.message)
    } else {
      setMlSent(true)
    }
  }

  function switchTab(t: Tab) {
    setTab(t)
    setError('')
    setMlError('')
    setMlSent(false)
  }

  return (
    <div className="login-page">
      {/* ── Nav bar ── */}
      <header className="login-topbar">
        <span className="login-brand-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </span>
        <span className="login-brand-text">Strategos</span>
      </header>

      {/* ── Centered card ── */}
      <div className="login-center">
        <div className="login-card">
          <h1 className="login-heading">Iniciar sessão</h1>

          {/* ── Tabs ── */}
          <div className="login-tabs">
            <button
              className={`login-tab${tab === 'password' ? ' active' : ''}`}
              onClick={() => switchTab('password')}
            >
              Email + Palavra-passe
            </button>
            <button
              className={`login-tab${tab === 'magic' ? ' active' : ''}`}
              onClick={() => switchTab('magic')}
            >
              Magic Link
            </button>
          </div>

          {/* ── Email + Password tab ── */}
          {tab === 'password' && (
            <form className="login-form" onSubmit={handleSignIn} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  className="login-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="utilizador@org.pt"
                  required
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="login-password">Palavra-passe</label>
                <input
                  id="login-password"
                  className="login-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && <p className="login-error">{error}</p>}
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? <span className="login-spinner" /> : 'Entrar'}
              </button>
            </form>
          )}

          {/* ── Magic Link tab ── */}
          {tab === 'magic' && (
            <form className="login-form" onSubmit={handleMagicLink} noValidate>
              {mlSent ? (
                <div className="login-success">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Link enviado para <strong>{mlEmail}</strong>. Verifique o seu email.
                </div>
              ) : (
                <>
                  <div className="login-field">
                    <label className="login-label" htmlFor="login-ml-email">Email</label>
                    <input
                      id="login-ml-email"
                      className="login-input"
                      type="email"
                      autoComplete="email"
                      value={mlEmail}
                      onChange={e => setMlEmail(e.target.value)}
                      placeholder="utilizador@org.pt"
                      required
                    />
                  </div>
                  {mlError && <p className="login-error">{mlError}</p>}
                  <button className="login-btn" type="submit" disabled={mlLoading}>
                    {mlLoading ? <span className="login-spinner" /> : 'Enviar link'}
                  </button>
                </>
              )}
            </form>
          )}

          <p className="login-note">
            Conta sem acesso? Contacte o administrador.
          </p>
        </div>
      </div>
    </div>
  )
}
