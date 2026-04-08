import './Dashboard.css'
import { useState } from 'react'
import Card from '../../components/Card/Card'
import KpiCard from '../../components/KpiCard/KpiCard'
import Table, { type Column } from '../../components/Table/Table'

const DETAIL_COLS: Column[] = [
  { key: 'nome',       label: 'Designação',    sortable: true },
  { key: 'total',      label: 'Total',         sortable: true },
  { key: 'concluidas', label: 'Concluídas',    sortable: true },
  { key: 'em_dia',     label: 'Em dia',        sortable: true },
  { key: 'em_atraso',  label: 'Em atraso',     sortable: true },
  { key: 'grau_exec',  label: 'Grau Execução', sortable: true },
  { key: 'exec_obj',   label: 'Exec. obj.',    sortable: true },
  { key: 'conc_geral', label: 'Conc. Geral',   sortable: true },
  { key: 'cg_obj',     label: 'C.G.Obj.',      sortable: true },
  { key: 'conc_data',  label: 'Conc. Data',    sortable: true },
  { key: 'cd_obj',     label: 'C.D.Obj.',      sortable: true },
]

export default function Dashboard() {
  const [chip, setChip] = useState('eixo')

  return (
    <>
      {/* ── Row 1: Dados Gerais + Indicadores ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Dados Gerais */}
        <Card title="Dados Gerais">
          <div className="kpi-2col">
            <KpiCard label="Total actividades" value="—" />
            <KpiCard label="Concluídas"        value="—" color="green" />
            <KpiCard label="Em dia"            value="—" color="blue" />
            <KpiCard label="Em atraso"         value="—" color="red" />
          </div>
        </Card>

        {/* Indicadores de Concretização */}
        <Card title="Indicadores de Concretização">
          {/* Realizado */}
          <div className="ind-section">
            <div className="ind-section-header">
              <span className="ind-dot" style={{ background: 'var(--navy)' }} />
              Realizado
            </div>
            <div className="kpi-3col">
              <KpiCard label="Grau execução"  value="—" color="navy" />
              <KpiCard label="Conc. geral"    value="—" color="navy" />
              <KpiCard label="Conc. à data"   value="—" color="navy" />
            </div>
          </div>

          {/* Objectivo */}
          <div className="ind-section">
            <div className="ind-section-header">
              <span className="ind-dot" style={{ background: 'var(--green)' }} />
              Objectivo
            </div>
            <div className="kpi-3col ind-dashed">
              <KpiCard label="Exec. obj."        value="—" color="green" />
              <KpiCard label="Conc. geral obj."  value="—" color="green" />
              <KpiCard label="Conc. data obj."   value="—" color="green" />
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 2: Bar chart + Donut ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card title="Actividades por Eixo — Estado">
          <div className="page-placeholder" style={{ minHeight: 200 }}>
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--text3)" strokeWidth="1.5">
              <rect x="3" y="12" width="4" height="9" /><rect x="10" y="7" width="4" height="14" /><rect x="17" y="4" width="4" height="17" />
            </svg>
            <p>Gráfico de barras — a implementar</p>
          </div>
        </Card>

        <Card title="Estado Global">
          <div className="page-placeholder" style={{ minHeight: 200 }}>
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--text3)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 015.657 15.657" strokeDasharray="3 2" />
            </svg>
            <p>Gráfico donut — a implementar</p>
          </div>
        </Card>
      </div>

      {/* ── Row 3: Detalhe table ── */}
      <Card title="Detalhe por Eixo e Plano de Acção">
        <div className="toggle-chips">
          <button
            className={`chip${chip === 'eixo' ? ' active' : ''}`}
            onClick={() => setChip('eixo')}
          >
            Eixo
          </button>
          <button
            className={`chip${chip === 'eixo-plano' ? ' active' : ''}`}
            onClick={() => setChip('eixo-plano')}
          >
            Eixo + Plano
          </button>
        </div>
        <Table columns={DETAIL_COLS} rows={[]} emptyMessage="Sem dados carregados" />
      </Card>
    </>
  )
}
