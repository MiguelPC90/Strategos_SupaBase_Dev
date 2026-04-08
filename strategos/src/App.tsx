import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
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
