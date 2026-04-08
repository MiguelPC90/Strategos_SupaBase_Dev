import Card from '../../components/Card/Card'
import Table, { type Column } from '../../components/Table/Table'
import Badge from '../../components/Badge/Badge'
import ProgressBar from '../../components/ProgressBar/ProgressBar'

const COLUMNS: Column[] = [
  { key: 'nome',        label: 'Actividade',  sortable: true },
  { key: 'responsavel', label: 'Responsável', sortable: true },
  { key: 'inicio',      label: 'Início',      sortable: true },
  { key: 'fim',         label: 'Fim',         sortable: true },
  { key: 'pct',         label: 'Progresso',   render: v => <ProgressBar value={(v as number) ?? 0} /> },
  { key: 'estado',      label: 'Estado',      render: v => v ? <Badge variant="grey">{v as string}</Badge> : '—' },
]

export default function Actividades() {
  return (
    <Card title="Actividades">
      <Table columns={COLUMNS} rows={[]} emptyMessage="Sem actividades carregadas" />
    </Card>
  )
}
