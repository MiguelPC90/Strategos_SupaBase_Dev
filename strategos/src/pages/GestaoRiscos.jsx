import Card from '../components/Card'
import Table from '../components/Table'
import Badge from '../components/Badge'
import KpiCard from '../components/KpiCard'

const COLUMNS = [
  { key: 'descricao', label: 'Descrição', sortable: true },
  { key: 'plano', label: 'Plano', sortable: true },
  { key: 'impacto', label: 'Impacto', sortable: true },
  { key: 'probabilidade', label: 'Probabilidade', sortable: true },
  { key: 'nivel', label: 'Nível', render: v => v ? <Badge variant="amber">{v}</Badge> : '—' },
  { key: 'estado', label: 'Estado', render: v => v ? <Badge variant="grey">{v}</Badge> : '—' },
  { key: 'mitigacao', label: 'Mitigação' },
]

export default function GestaoRiscos() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <KpiCard label="Total riscos" value="—" subtitle="Identificados" />
        <KpiCard label="Críticos" value="—" subtitle="Nível alto" color="red" />
        <KpiCard label="Médios" value="—" subtitle="Em mitigação" color="amber" />
        <KpiCard label="Baixos / fechados" value="—" subtitle="Controlados" color="green" />
      </div>

      <Card
        title="Registo de riscos"
        actions={<button className="topbar-btn" style={{ fontSize: 11 }}>+ Novo risco</button>}
      >
        <Table columns={COLUMNS} rows={[]} emptyMessage="Sem riscos registados" />
      </Card>
    </>
  )
}
