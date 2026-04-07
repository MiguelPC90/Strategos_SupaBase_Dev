import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Table from '../components/Table'
import Badge from '../components/Badge'

const BUDGET_COLS = [
  { key: 'rubrica', label: 'Rubrica', sortable: true },
  { key: 'categoria', label: 'Categoria', sortable: true },
  { key: 'capex', label: 'CAPEX/OPEX', render: v => <Badge variant={v ? 'navy' : 'grey'}>{v ? 'CAPEX' : 'OPEX'}</Badge> },
  { key: 'orcamento', label: 'Orçamento', sortable: true },
]

const CONTRACT_COLS = [
  { key: 'fornecedor', label: 'Fornecedor', sortable: true },
  { key: 'categoria', label: 'Categoria', sortable: true },
  { key: 'valor', label: 'Valor total', sortable: true },
  { key: 'data_adjudicacao', label: 'Adjudicação', sortable: true },
]

export default function GestaoFinanceira() {
  return (
    <>
      <PageHeader title="Gestão Financeira" subtitle="Orçamento, contratos e faturas">
        <button className="topbar-btn">+ Nova rubrica</button>
      </PageHeader>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card title="Rubricas orçamentais">
          <Table columns={BUDGET_COLS} rows={[]} emptyMessage="Sem rubricas carregadas" />
        </Card>

        <Card title="Contratos">
          <Table columns={CONTRACT_COLS} rows={[]} emptyMessage="Sem contratos carregados" />
        </Card>
      </div>
    </>
  )
}
