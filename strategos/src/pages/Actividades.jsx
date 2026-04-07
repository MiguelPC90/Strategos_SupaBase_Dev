import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Table from '../components/Table'
import Badge from '../components/Badge'
import ProgressBar from '../components/ProgressBar'

const COLUMNS = [
  { key: 'nome', label: 'Actividade', sortable: true },
  { key: 'responsavel', label: 'Responsável', sortable: true },
  { key: 'inicio', label: 'Início', sortable: true },
  { key: 'fim', label: 'Fim', sortable: true },
  { key: 'pct', label: 'Progresso', render: v => <ProgressBar value={v ?? 0} /> },
  { key: 'estado', label: 'Estado', render: v => v ? <Badge variant="grey">{v}</Badge> : '—' },
]

export default function Actividades() {
  return (
    <>
      <PageHeader title="Actividades" subtitle="Lista de actividades do plano" />
      <Card title="Actividades">
        <Table columns={COLUMNS} rows={[]} emptyMessage="Sem actividades carregadas" />
      </Card>
    </>
  )
}
