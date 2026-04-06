import type { MouseEventHandler } from 'react'
import { useFilters } from '../context/FilterContext'

interface TopbarProps {
    userName: string
    onToggle: MouseEventHandler<HTMLButtonElement>
    onLogout: MouseEventHandler<HTMLButtonElement>
}

export default function Topbar({ userName, onToggle, onLogout }: TopbarProps) {
    const { n0, n1, n0Options, n1Options, setN0, setN1 } = useFilters()

    return (
        <header className="topbar">
            <div className="topbar-left">
                <button className="sidebar-toggle-btn" onClick={onToggle} aria-label="Alternar menu">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>
                <div>
                    <h1>Strategos PMO</h1>
                    <p>Plataforma de Gestão de Projectos Estratégicos</p>
                </div>
            </div>
            <div className="topbar-actions">
                <div className="topbar-filter" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <label className="pm-field" style={{ margin: '0' }}>
                        <span>N0</span>
                        <select className="risk-select" value={n0} onChange={(event) => setN0(event.target.value)}>
                            <option value="">Todos</option>
                            {n0Options.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="pm-field" style={{ margin: '0' }}>
                        <span>N1</span>
                        <select
                            className="risk-select"
                            value={n1}
                            onChange={(event) => setN1(event.target.value)}
                            disabled={!n0}
                        >
                            <option value="">Todos</option>
                            {n1Options.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="topbar-user">
                    <span className="topbar-user-name">{userName}</span>
                </div>
                <button className="btn btn-ghost" onClick={onLogout} type="button">
                    Sair
                </button>
            </div>
        </header>
    )
}
