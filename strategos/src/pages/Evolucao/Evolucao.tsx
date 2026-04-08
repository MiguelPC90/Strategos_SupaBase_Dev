import Card from '../../components/Card/Card'
import KpiCard from '../../components/KpiCard/KpiCard'

export default function Evolucao() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
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
