import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { BrandingProvider } from './context/BrandingContext'
import Layout from './components/Layout/Layout'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import Actividades from './pages/Actividades/Actividades'
import Gantt from './pages/Gantt/Gantt'
import Evolucao from './pages/Evolucao/Evolucao'
import PontoSituacao from './pages/PontoSituacao/PontoSituacao'
import ExecucaoFinanceira from './pages/ExecucaoFinanceira/ExecucaoFinanceira'
import Recursos from './pages/Recursos/Recursos'
import BudgetPage from './pages/BudgetPage/BudgetPage'
import Admin from './pages/Admin/Admin'
import Perfil from './pages/Perfil/Perfil'
import PlanosCatalog from './pages/PlanosCatalog/PlanosCatalog'
import PlanoPage from './pages/PlanoPage/PlanoPage'
import { useAuth } from './hooks/useAuth'
import { useRole } from './hooks/useRole'
import { usePermissions } from './hooks/usePermissions'
import type { PageKey } from './types/index'

const ALL_PAGES: PageKey[] = [
  'dashboard', 'actividades', 'gantt', 'evolucao', 'ponto-situacao',
  'exec-financeira', 'recursos', 'gestao-iniciativas', 'gestao-pds',
  'gestao-riscos', 'gestao-financeira', 'gestao-recursos',
]

function PageGuard({ page, children }: { page: PageKey; children: React.ReactNode }) {
  const { hasAccess, loading } = usePermissions()
  const navigate = useNavigate()

  if (loading) return null

  if (!hasAccess(page)) {
    const firstAccessible = ALL_PAGES.find(p => p !== page && hasAccess(p))
    if (firstAccessible) {
      return <Navigate to={`/${firstAccessible}`} replace />
    }
    // No pages accessible at all — show styled denial card
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 320,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          textAlign: 'center',
          maxWidth: 360,
          padding: '2rem',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>Sem permissão</div>
          <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.5 }}>
            Não tens acesso a esta página. Contacta o administrador.
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1.25rem',
              background: 'var(--navy)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Ir para o Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useRole()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg3)',
      }}>
        <span style={{
          width: 28,
          height: 28,
          border: '3px solid var(--border2)',
          borderTopColor: 'var(--navy)',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return <Login />

  return <>{children}</>
}

export default function App() {
  return (
    <ToastProvider>
    <BrandingProvider>
    <FavoritesProvider>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"          element={<PageGuard page="dashboard">         <Dashboard />         </PageGuard>} />
          <Route path="actividades"        element={<PageGuard page="actividades">       <Actividades />       </PageGuard>} />
          <Route path="gantt"              element={<PageGuard page="gantt">             <Gantt />             </PageGuard>} />
          <Route path="evolucao"           element={<PageGuard page="evolucao">          <Evolucao />          </PageGuard>} />
          <Route path="ponto-situacao"     element={<PageGuard page="ponto-situacao">    <PontoSituacao />     </PageGuard>} />
          <Route path="exec-financeira"    element={<PageGuard page="exec-financeira">   <ExecucaoFinanceira /></PageGuard>} />
          <Route path="recursos"           element={<PageGuard page="recursos">          <Recursos />          </PageGuard>} />
          <Route path="gestao-financeira"  element={<Navigate to="/budget" replace />} />
          <Route path="budget"             element={<PageGuard page="gestao-financeira"> <BudgetPage />        </PageGuard>} />
          <Route path="admin"              element={<AdminGuard><Admin /></AdminGuard>} />
          <Route path="perfil"            element={<Perfil />} />
          <Route path="planos"            element={<PlanosCatalog />} />
          <Route path="planos/:planoId"   element={<PlanoPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </FavoritesProvider>
    </BrandingProvider>
    </ToastProvider>
  )
}
