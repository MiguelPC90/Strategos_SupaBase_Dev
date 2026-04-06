import { type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Activities from './pages/Activities'
import Evolution from './pages/Evolution'
import Gantt from './pages/Gantt'
import PDS from './pages/PDS'
import FinanceExecution from './pages/FinanceExecution'
import InitiativeManagement from './pages/InitiativeManagement'
import PDSManagement from './pages/PDSManagement'
import RiskManagement from './pages/RiskManagement'
import FinanceManagement from './pages/FinanceManagement'
import Admin from './pages/Admin'
import Login from './pages/Login'
import { UserProvider, useUser } from './context/UserContext'
import { FilterProvider } from './context/FilterContext'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, session } = useUser()
  if (loading) {
    return <div className="page-loading">A carregar sessão...</div>
  }

  return session ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <FilterProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />
              <Route path="activities" element={<Activities />} />
              <Route path="evolution" element={<Evolution />} />
              <Route path="gantt" element={<Gantt />} />
              <Route path="pds" element={<PDS />} />
              <Route path="finance-execution" element={<FinanceExecution />} />
              <Route path="initiative-management" element={<InitiativeManagement />} />
              <Route path="pds-management" element={<PDSManagement />} />
              <Route path="risk-management" element={<RiskManagement />} />
              <Route path="finance-management" element={<FinanceManagement />} />
              <Route path="admin" element={<Admin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </FilterProvider>
      </UserProvider>
    </BrowserRouter>
  )
}

export default App

