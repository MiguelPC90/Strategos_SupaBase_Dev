import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Table from '../components/Table'
import Badge from '../components/Badge'

const COLUMNS = [
  { key: 'plano', label: 'Plano de Ação', sortable: true },
  { key: 'responsavel', label: 'Responsável', sortable: true },
  { key: 'estado', label: 'Estado', render: v => v ? <Badge variant="grey">{v}</Badge> : '—' },
  { key: 'comprometimentos', label: 'Comprometimentos' },
  { key: 'proximos', label: 'Próximos passos' },
]

export default function PontoSituacao() {
  return (
    <>
      <PageHeader title="Ponto de Situação" subtitle="Relatório de situação por plano de ação" />
      <Card title="Pontos de situação">
        <Table columns={COLUMNS} rows={[]} emptyMessage="Sem pontos de situação carregados" />
      </Card>
    </>
  )
}
