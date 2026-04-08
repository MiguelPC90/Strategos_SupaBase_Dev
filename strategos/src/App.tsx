import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Actividades from './pages/Actividades'
import Gantt from './pages/Gantt'
import Evolucao from './pages/Evolucao'
import PontoSituacao from './pages/PontoSituacao'
import ExecucaoFinanceira from './pages/ExecucaoFinanceira'
import Recursos from './pages/Recursos'
import GestaoIniciativas from './pages/GestaoIniciativas'
import GestaoPDS from './pages/GestaoPDS'
import GestaoRiscos from './pages/GestaoRiscos'
import GestaoFinanceira from './pages/GestaoFinanceira'
import GestaoRecursos from './pages/GestaoRecursos'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="actividades" element={<Actividades />} />
          <Route path="gantt" element={<Gantt />} />
          <Route path="evolucao" element={<Evolucao />} />
          <Route path="ponto-situacao" element={<PontoSituacao />} />
          <Route path="exec-financeira" element={<ExecucaoFinanceira />} />
          <Route path="recursos" element={<Recursos />} />
          <Route path="gestao-iniciativas" element={<GestaoIniciativas />} />
          <Route path="gestao-pds" element={<GestaoPDS />} />
          <Route path="gestao-riscos" element={<GestaoRiscos />} />
          <Route path="gestao-financeira" element={<GestaoFinanceira />} />
          <Route path="gestao-recursos" element={<GestaoRecursos />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
