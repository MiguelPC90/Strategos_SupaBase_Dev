import Card from '../../components/Card/Card'
import Table, { type Column } from '../../components/Table/Table'
import Badge from '../../components/Badge/Badge'

const COLUMNS: Column[] = [
  { key: 'plano',            label: 'Plano de Ação',   sortable: true },
  { key: 'responsavel',      label: 'Responsável',     sortable: true },
  { key: 'estado',           label: 'Estado',          render: v => v ? <Badge variant="grey">{v as string}</Badge> : '—' },
  { key: 'comprometimentos', label: 'Comprometimentos' },
  { key: 'proximos',         label: 'Próximos passos' },
]

export default function PontoSituacao() {
  return (
    <Card title="Ponto de situação">
      <Table columns={COLUMNS} rows={[]} emptyMessage="Sem pontos de situação carregados" />
    </Card>
  )
}
