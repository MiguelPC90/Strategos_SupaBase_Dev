import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface SidebarProps {
    collapsed: boolean
    onToggle: () => void
}

interface NavItem {
    label: string
    path: string
    icon: ReactNode
}

interface NavGroup {
    label: string
    items: NavItem[]
}

const navGroups: NavGroup[] = [
    {
        label: 'Visão',
        items: [
            {
                label: 'Dashboard',
                path: '/',
                icon: (
                    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                ),
            },
            {
                label: 'Atividades',
                path: '/activities',
                icon: (
                    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                        <rect x="9" y="3" width="6" height="4" rx="1" />
                        <line x1="9" y1="12" x2="15" y2="12" />
                        <line x1="9" y1="16" x2="13" y2="16" />
                    </svg>
                ),
            },
            {
                label: 'Evolução',
                path: '/evolution',
                icon: (
                    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                ),
            },
            {
                label: 'Gantt',
                path: '/gantt',
                icon: (
                    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="15" y2="12" />
                        <line x1="3" y1="18" x2="18" y2="18" />
                    </svg>
                ),
            },
            {
                label: 'PDS',
                path: '/pds',
                icon: (
                    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                ),
            },
            {
                label: 'Execução Financeira',
                path: '/finance-execution',
                icon: (
                    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                    </svg>
                ),
            },
        ],
    },
    {
        label: 'Gestão',
        items: [
            {
                label: 'Iniciativas',
                path: '/initiative-management',
                icon: (
                    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                ),
            },
            {
                label: 'PDS Gestão',
                path: '/pds-management',
                icon: (
                    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                ),
            },
            {
                label: 'Riscos',
                path: '/risk-management',
                icon: (
                    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                ),
            },
            {
                label: 'Finanças',
                path: '/finance-management',
                icon: (
                    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                ),
            },
        ],
    },
    {
        label: 'Admin',
        items: [
            {
                label: 'Admin',
                path: '/admin',
                icon: (
                    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51A1.65 1.65 0 0014.32 6l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9H19.5a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                ),
            },
        ],
    },
]

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const location = useLocation()

    return (
        <aside className="sidebar">
            <div className="sidebar-top">
                <button className="sidebar-toggle-btn" onClick={onToggle} aria-label="Alternar sidebar">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            <div className="sidebar-nav">
                {navGroups.map((group) => (
                    <div key={group.label}>
                        <span className="sidebar-group-lbl">{group.label}</span>
                        {group.items.map((item) => {
                            const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/')
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`nav-item${isActive ? ' active' : ''}`}
                                    data-tooltip={collapsed ? item.label : undefined}
                                >
                                    {item.icon}
                                    <span className="nav-label">{item.label}</span>
                                </Link>
                            )
                        })}
                    </div>
                ))}
            </div>
        </aside>
    )
}
