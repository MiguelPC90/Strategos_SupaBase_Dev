import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import KpiCard from '../components/KpiCard'
import Badge from '../components/Badge'
import ProgressBar from '../components/ProgressBar'

export default function Dashboard() {
  return (
    <>
      <PageHeader
        title="Resumo Executivo"
        subtitle="Visão geral do plano estratégico"
      />

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard label="Iniciativas" value="—" subtitle="Total" color="navy" />
        <KpiCard label="Concluídas" value="—" subtitle="% do total" color="green" />
        <KpiCard label="Em risco" value="—" subtitle="Requerem atenção" color="amber" />
        <KpiCard label="Atrasadas" value="—" subtitle="Fora do prazo" color="red" />
      </div>

      {/* Cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card title="Progresso por Eixo">
          <div className="page-placeholder" style={{ minHeight: 160 }}>
            <p>Gráfico de progresso — a implementar</p>
          </div>
        </Card>

        <Card title="Estado das Iniciativas">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Concluídas', pct: 0, color: 'green' },
              { label: 'Em curso', pct: 0, color: 'blue' },
              { label: 'Em risco', pct: 0, color: 'amber' },
              { label: 'Atrasadas', pct: 0, color: 'red' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Badge variant={item.color}>{item.label}</Badge>
                <ProgressBar value={item.pct} color={item.color} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
