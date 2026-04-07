import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Table from '../components/Table'
import Badge from '../components/Badge'
import ProgressBar from '../components/ProgressBar'

const COLUMNS = [
  { key: 'nome', label: 'Iniciativa', sortable: true },
  { key: 'eixo', label: 'Eixo', sortable: true },
  { key: 'responsavel', label: 'Responsável', sortable: true },
  { key: 'sponsor', label: 'Sponsor', sortable: true },
  { key: 'inicio', label: 'Início', sortable: true },
  { key: 'fim', label: 'Fim', sortable: true },
  { key: 'pct', label: 'Progresso', render: v => <ProgressBar value={v ?? 0} /> },
  { key: 'estado', label: 'Estado', render: v => v ? <Badge variant="grey">{v}</Badge> : '—' },
]

export default function GestaoIniciativas() {
  return (
    <>
      <PageHeader title="Gestão de Iniciativas" subtitle="Gerir e editar iniciativas do plano">
        <button className="topbar-btn">+ Nova iniciativa</button>
      </PageHeader>
      <Card title="Iniciativas">
        <Table columns={COLUMNS} rows={[]} emptyMessage="Sem iniciativas carregadas" />
      </Card>
    </>
  )
}
