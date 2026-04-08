import Card from '../../components/Card/Card'
import Table, { type Column } from '../../components/Table/Table'
import Badge from '../../components/Badge/Badge'

const BUDGET_COLS: Column[] = [
  { key: 'rubrica',   label: 'Rubrica',    sortable: true },
  { key: 'categoria', label: 'Categoria',  sortable: true },
  { key: 'capex',     label: 'CAPEX/OPEX', render: v => <Badge variant={v ? 'navy' : 'grey'}>{v ? 'CAPEX' : 'OPEX'}</Badge> },
  { key: 'orcamento', label: 'Orçamento',  sortable: true },
]

const CONTRACT_COLS: Column[] = [
  { key: 'fornecedor',       label: 'Fornecedor',  sortable: true },
  { key: 'categoria',        label: 'Categoria',   sortable: true },
  { key: 'valor',            label: 'Valor total', sortable: true },
  { key: 'data_adjudicacao', label: 'Adjudicação', sortable: true },
]

export default function GestaoFinanceira() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card
        title="Rubricas orçamentais"
        actions={<button className="topbar-btn" style={{ fontSize: 11 }}>+ Nova rubrica</button>}
      >
        <Table columns={BUDGET_COLS} rows={[]} emptyMessage="Sem rubricas carregadas" />
      </Card>

      <Card title="Contratos">
        <Table columns={CONTRACT_COLS} rows={[]} emptyMessage="Sem contratos carregados" />
      </Card>
    </div>
  )
}
