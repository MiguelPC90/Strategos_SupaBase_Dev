import './Layout.css'
import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import SplashScreen from '../SplashScreen/SplashScreen'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Star, Search } from 'lucide-react'
import Badge from '../Badge/Badge'
import { useAuth } from '../../hooks/useAuth'
import { useRole } from '../../hooks/useRole'
import { usePermissions } from '../../hooks/usePermissions'
import { ToastList } from '../Toast/Toast'
import { usePrograms } from '../../hooks/usePrograms'
import { usePlanos } from '../../hooks/usePlanos'
import { useFavorites } from '../../hooks/useFavorites'
import { supabase } from '../../lib/supabase'
import { setThresholds } from '../../lib/rollup'
import type { PageKey } from '../../types/index'
import Breadcrumb from '../Breadcrumb/Breadcrumb'
import { CommandPalette } from '../CommandPalette/CommandPalette'
import { useBranding } from '../../context/BrandingContext'
import StratgosWordmark from '../Brand/StratgosWordmark'
import StratgosGMark from '../Brand/StratgosGMark'

interface NavItemConfig {
  to: string
  label: string
  icon: ReactNode
}

interface NavItemProps extends NavItemConfig {
  isManage?: boolean
}

const NAV_VIEW: NavItemConfig[] = [
  {
    to: '/dashboard',
    label: 'Resumo executivo',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: '/actividades',
    label: 'Actividades',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },
  {
    to: '/gantt',
    label: 'Gantt',
    icon: (
      <svg viewBox="0 0 24 24">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="15" y2="12" />
        <line x1="3" y1="18" x2="18" y2="18" />
      </svg>
    ),
  },
  {
    to: '/evolucao',
    label: 'Evolução',
    icon: (
      <svg viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    to: '/ponto-situacao',
    label: 'Ponto de situação',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    to: '/exec-financeira',
    label: 'Execução Financeira',
    icon: (
      <svg viewBox="0 0 24 24">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    to: '/recursos',
    label: 'Recursos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
        <circle cx="19" cy="7" r="2" />
        <path d="M19 13v8M16 16h6" />
      </svg>
    ),
  },
]

const NAV_PLANOS: NavItemConfig[] = [
  {
    to: '/planos',
    label: 'Planos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    ),
  },
]

const NAV_MANAGE: NavItemConfig[] = [
  {
    to: '/budget',
    label: 'Gestão Financeira',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
]

function NavItem({ to, label, icon, isManage = false }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `nav-item${isActive ? (isManage ? ' active-manage' : ' active') : ''}`
      }
      title={label}
    >
      {icon}
      <span className="nav-label">{label}</span>
    </NavLink>
  )
}

function getInitials(fullName: string | null | undefined, email: string | undefined): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return fullName.slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'U'
}

const ROLE_LABEL: Record<string, string> = {
  admin:           'Admin',
  program_manager: 'Prog. Manager',
  editor:          'Gestor',
  sponsor:         'Sponsor',
  stakeholder:     'Stakeholder',
  viewer:          'Visualizador',
}

export default function Layout() {
  const location = useLocation()
  const { signOut, user, loading: authLoading } = useAuth()
  const { profile, role, isAdmin } = useRole()
  const { hasAccess } = usePermissions()

  const { programs, loading: programsLoading } = usePrograms()
  const { planos } = usePlanos()
  const { favorites } = useFavorites()

  const programMap = useMemo(() => new Map(programs.map(p => [p.id, p])), [programs])
  const planoMap   = useMemo(() => new Map(planos.map(p => [p.id, p])),   [planos])

  const { mode, clientTitle, clientSubtitle, clientLogoUrl, loading: brandingLoading } = useBranding()

  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const [configLoaded, setConfigLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_config')
      .select('config_key,data')
      .in('config_key', [
        'status_delay_threshold_aggregates', 'status_delay_threshold', 'status_delay_threshold_leaves',
      ])
      .then(({ data }) => {
        if (cancelled) return
        if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const map: Record<string, string> = {}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const row of data as any[]) map[row.config_key] = row.data ?? ''
          const aggThreshold    = parseInt(map['status_delay_threshold_aggregates'] ?? map['status_delay_threshold'] ?? '20') || 20
          const leavesThreshold = parseInt(map['status_delay_threshold_leaves'] ?? '0') || 0
          setThresholds(aggThreshold, leavesThreshold)
        }
        setConfigLoaded(true)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [])

  const initials = getInitials(profile?.full_name, user?.email)
  const displayName = profile?.full_name || user?.email || 'Utilizador'
  const displayEmail = user?.email ?? ''
  const roleLabel = role ? (ROLE_LABEL[role] ?? role) : null

  const essentialLoaded =
    !authLoading &&
    (!user || (configLoaded && !programsLoading && !brandingLoading))

  const showSplash = !essentialLoaded

  return (
    <>
      <SplashScreen fadeOut={!showSplash} />
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* ── Sidebar (always collapsed, expands on hover) ── */}
      <nav className="sidebar collapsed">
        <div className="sidebar-nav">
          <span className="sidebar-group-lbl">Visualização</span>
          {NAV_VIEW.filter(item => hasAccess(item.to.slice(1) as PageKey)).map(item => (
            <NavItem key={item.to} {...item} />
          ))}

          <div className="sidebar-sep" />
          <span className="sidebar-group-lbl">Por Plano</span>
          {NAV_PLANOS.map(item => (
            <NavItem key={item.to} {...item} />
          ))}

          {favorites.length > 0 && (
            <>
              <div className="sidebar-sep" />
              <span className="sidebar-group-lbl">Favoritos</span>
              {favorites.map(f => {
                const plano = planoMap.get(f.plano_id)
                if (!plano) return null
                const progName = plano.program_id ? (programMap.get(plano.program_id)?.name ?? null) : null
                return (
                  <NavLink
                    key={f.plano_id}
                    to={`/planos/${f.plano_id}`}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    title={plano.name}
                  >
                    <Star size={16} strokeWidth={1.5} />
                    <span className="nav-label nav-fav-label">
                      <span className="nav-fav-name">{plano.name}</span>
                      {progName && <span className="nav-fav-prog">{progName}</span>}
                    </span>
                  </NavLink>
                )
              })}
            </>
          )}

          <div className="sidebar-sep" />
          <span className="sidebar-group-lbl">Gestão</span>
          {NAV_MANAGE.filter(item => hasAccess(item.to.slice(1) as PageKey)).map(item => (
            <NavItem key={item.to} {...item} isManage />
          ))}
        </div>

        {isAdmin && (
          <div className="sidebar-bottom">
            <NavItem
              to="/admin"
              label="Administração"
              icon={
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              }
            />
          </div>
        )}
      </nav>

      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand">
          {mode === 'cobrand' ? (
            <>
              <StratgosGMark size={28} />
              <span className="topbar-divider" aria-hidden="true" />
              {clientLogoUrl && (
                <img
                  src={clientLogoUrl}
                  alt={clientTitle || 'Cliente'}
                  className="topbar-client-logo"
                />
              )}
              {clientTitle && (
                <span className="topbar-client-name">{clientTitle}</span>
              )}
              {clientSubtitle && (
                <>
                  <span className="topbar-divider" aria-hidden="true" />
                  <span className="topbar-subtitle">{clientSubtitle}</span>
                </>
              )}
            </>
          ) : (
            <>
              <StratgosWordmark size={20} onDark={true} />
              {clientSubtitle && (
                <>
                  <span className="topbar-divider" aria-hidden="true" />
                  <span className="topbar-subtitle">{clientSubtitle}</span>
                </>
              )}
            </>
          )}
        </div>

        <div className="topbar-spacer" />

        <button
          className="topbar-search-btn"
          onClick={() => setPaletteOpen(o => !o)}
          aria-label="Pesquisar plano (⌘K)"
        >
          <Search size={15} />
          <span className="topbar-search-hint">⌘K</span>
        </button>

        <div style={{ position: 'relative' }} ref={profileRef}>
          <button
            className="topbar-avatar"
            onClick={() => setProfileOpen(o => !o)}
            aria-label="Menu de perfil"
          >
            {initials}
          </button>
          {profileOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-name">{displayName}</div>
                <div className="profile-dropdown-email">{displayEmail}</div>
                {roleLabel && (
                  <div className="profile-dropdown-role">
                    <Badge variant={role === 'admin' ? 'navy' : (role === 'editor' || role === 'program_manager') ? 'blue' : role === 'sponsor' ? 'amber' : 'grey'}>
                      {roleLabel}
                    </Badge>
                  </div>
                )}
              </div>
              <button className="dropdown-item" onClick={() => signOut()}>
                <svg viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Terminar sessão
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="main-content">
        {!location.pathname.startsWith('/admin') && !location.pathname.startsWith('/planos') && <Breadcrumb />}

        <div className="page-body">
          <Outlet />
        </div>
        <footer className="app-footer">
          Powered by <StratgosWordmark size={14} onDark={false} />
        </footer>
        <ToastList />
      </main>
    </>
  )
}
