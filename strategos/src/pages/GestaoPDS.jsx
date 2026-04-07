import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Table from '../components/Table'
import Badge from '../components/Badge'

const COLUMNS = [
  { key: 'plano', label: 'Plano de Ação', sortable: true },
  { key: 'responsavel', label: 'Responsável', sortable: true },
  { key: 'estado', label: 'Estado', render: v => v ? <Badge variant="grey">{v}</Badge> : '—' },
  { key: 'ultima_atualizacao', label: 'Última atualização', sortable: true },
]

export default function GestaoPDS() {
  return (
    <>
      <PageHeader title="Gestão PDS" subtitle="Gestão dos pontos de situação">
        <button className="topbar-btn">+ Novo PDS</button>
      </PageHeader>
      <Card title="Pontos de situação">
        <Table columns={COLUMNS} rows={[]} emptyMessage="Sem PDS carregados" />
      </Card>
    </>
  )
}
