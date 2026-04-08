import Card from '../components/Card'
import KpiCard from '../components/KpiCard'
import Table from '../components/Table'

const COLUMNS = [
  { key: 'rubrica', label: 'Rubrica', sortable: true },
  { key: 'orcamento', label: 'Orçamento', sortable: true },
  { key: 'executado', label: 'Executado', sortable: true },
  { key: 'percentagem', label: '% Execução', sortable: true },
  { key: 'desvio', label: 'Desvio' },
]

export default function ExecucaoFinanceira() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <KpiCard label="Orçamento total" value="—" subtitle="€" color="navy" />
        <KpiCard label="Executado" value="—" subtitle="€ / %" color="green" />
        <KpiCard label="Comprometido" value="—" subtitle="€" color="blue" />
        <KpiCard label="Desvio" value="—" subtitle="€" color="amber" />
      </div>

      <Card title="Execução por rubrica">
        <Table columns={COLUMNS} rows={[]} emptyMessage="Sem dados financeiros carregados" />
      </Card>
    </>
  )
}
