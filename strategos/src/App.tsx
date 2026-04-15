import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import Actividades from './pages/Actividades/Actividades'
import Gantt from './pages/Gantt/Gantt'
import Evolucao from './pages/Evolucao/Evolucao'
import PontoSituacao from './pages/PontoSituacao/PontoSituacao'
import ExecucaoFinanceira from './pages/ExecucaoFinanceira/ExecucaoFinanceira'
import Recursos from './pages/Recursos/Recursos'
import GestaoIniciativas from './pages/GestaoIniciativas/GestaoIniciativas'
import GestaoPDS from './pages/GestaoPDS/GestaoPDS'
import GestaoRiscos from './pages/GestaoRiscos/GestaoRiscos'
import GestaoFinanceira from './pages/GestaoFinanceira/GestaoFinanceira'
import GestaoRecursos from './pages/GestaoRecursos/GestaoRecursos'
import Admin from './pages/Admin/Admin'
import { useAuth } from './hooks/useAuth'
import { usePermissions } from './hooks/usePermissions'
import type { PageKey } from './types/index'

function PageGuard({ page, children }: { page: PageKey; children: React.ReactNode }) {
  const { hasAccess, loading } = usePermissions()
  if (loading) return null
  if (!hasAccess(page)) {
    return (
      <div className="page-placeholder">
        <p>Sem permissão para aceder a esta página.</p>
      </div>
    )
  }
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
          <Route path="gestao-iniciativas" element={<PageGuard page="gestao-iniciativas"><GestaoIniciativas /> </PageGuard>} />
          <Route path="gestao-pds"         element={<PageGuard page="gestao-pds">        <GestaoPDS />         </PageGuard>} />
          <Route path="gestao-riscos"      element={<PageGuard page="gestao-riscos">     <GestaoRiscos />      </PageGuard>} />
          <Route path="gestao-financeira"  element={<PageGuard page="gestao-financeira"> <GestaoFinanceira />  </PageGuard>} />
          <Route path="gestao-recursos"    element={<PageGuard page="gestao-recursos">   <GestaoRecursos />    </PageGuard>} />
          <Route path="admin"              element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
