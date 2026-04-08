import Card from '../components/Card'
import KpiCard from '../components/KpiCard'
import Table from '../components/Table'
import ProgressBar from '../components/ProgressBar'

const COLUMNS = [
  { key: 'nome', label: 'Recurso', sortable: true },
  { key: 'unidade', label: 'Unidade', sortable: true },
  { key: 'perfil', label: 'Perfil', sortable: true },
  { key: 'alocacao', label: 'Alocação FTE', sortable: true },
  { key: 'ocupacao', label: 'Ocupação', render: v => <ProgressBar value={v ?? 0} /> },
]

export default function Recursos() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
        <KpiCard label="Total recursos" value="—" subtitle="Pessoas" />
        <KpiCard label="FTE alocado" value="—" subtitle="Equivalente tempo inteiro" color="blue" />
        <KpiCard label="Taxa ocupação" value="—" subtitle="Média da equipa" color="green" />
      </div>

      <Card title="Recursos por plano">
        <Table columns={COLUMNS} rows={[]} emptyMessage="Sem recursos carregados" />
      </Card>
    </>
  )
}
