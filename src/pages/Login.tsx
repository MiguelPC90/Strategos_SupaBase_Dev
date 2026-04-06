import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()
    const { session, loading, signIn } = useUser()

    useEffect(() => {
        if (session) {
            navigate('/', { replace: true })
        }
    }, [session, navigate])

    if (loading) {
        return <div className="page-loading">A carregar...</div>
    }

    if (session) {
        return <Navigate to="/" replace />
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)

        try {
            await signIn(email, password)
            navigate('/', { replace: true })
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        }
    }

    return (
        <section className="card">
            <h1>Login</h1>
            <p>Autentique-se para aceder ao Strategos PMO.</p>
            <form className="form-grid" onSubmit={handleSubmit}>
                <label>
                    Email
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="seu.email@exemplo.com"
                    />
                </label>
                <label>
                    Palavra-passe
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                    />
                </label>
                {error ? <p className="text-error">{error}</p> : null}
                <button className="btn btn-primary" type="submit">
                    Entrar
                </button>
            </form>
        </section>
    )
}
