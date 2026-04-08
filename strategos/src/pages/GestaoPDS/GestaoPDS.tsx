import Card from '../../components/Card/Card'
import Table, { type Column } from '../../components/Table/Table'
import Badge from '../../components/Badge/Badge'

const COLUMNS: Column[] = [
  { key: 'plano',              label: 'Plano de Ação',     sortable: true },
  { key: 'responsavel',        label: 'Responsável',       sortable: true },
  { key: 'estado',             label: 'Estado',            render: v => v ? <Badge variant="grey">{v as string}</Badge> : '—' },
  { key: 'ultima_atualizacao', label: 'Última atualização', sortable: true },
]

export default function GestaoPDS() {
  return (
    <Card
      title="Gestão PDS"
      actions={<button className="topbar-btn" style={{ fontSize: 11 }}>+ Novo PDS</button>}
    >
      <Table columns={COLUMNS} rows={[]} emptyMessage="Sem PDS carregados" />
    </Card>
  )
}
