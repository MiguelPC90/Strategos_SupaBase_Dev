import './ContagemKpi.css'

export interface ContagemKpiProps {
  value: number
  total: number
  label: string
  delta?: number | null
  deltaVariant?: 'good' | 'neutral' | 'bad'
  variant?: 'default' | 'late'
  className?: string
}

export default function ContagemKpi({
  value, total, label,
  delta = null,
  variant = 'default',
  deltaVariant = 'neutral',
}: ContagemKpiProps) {
  const isLate = variant === 'late'
  return (
    <div className="contagem-kpi">
      <div className="contagem-kpi-numbers">
        <span className={`contagem-kpi-value t-headline t-tabular${isLate ? ' late' : ''}`}>{value}</span>
        <span className="contagem-kpi-denom">/ {total}</span>
      </div>
      <div className="contagem-kpi-label">{label}</div>
      {delta !== null && (
        <div className={`contagem-kpi-delta ${deltaVariant}`}>
          {delta >= 0 ? '+' : ''}{delta} últimos 7 dias
        </div>
      )}
    </div>
  )
}
