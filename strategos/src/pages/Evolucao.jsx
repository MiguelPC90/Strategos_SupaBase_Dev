import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import KpiCard from '../components/KpiCard'

export default function Evolucao() {
  return (
    <>
      <PageHeader title="Evolução" subtitle="Evolução temporal do plano" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard label="Snapshots" value="—" subtitle="Registos históricos" />
        <KpiCard label="Último snapshot" value="—" subtitle="Data" color="blue" />
        <KpiCard label="Tendência" value="—" subtitle="vs. snapshot anterior" color="green" />
      </div>

      <Card title="Evolução do progresso global">
        <div className="page-placeholder" style={{ minHeight: 200 }}>
          <p>Gráfico de evolução temporal — a implementar</p>
        </div>
      </Card>
    </>
  )
}
