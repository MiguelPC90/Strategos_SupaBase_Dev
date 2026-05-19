import './ContagemKpi.css'
import TermTooltip from '../TermTooltip/TermTooltip'

export interface ContagemKpiProps {
  value: number
  total: number
  label: string
  delta?: number | null
  deltaVariant?: 'good' | 'neutral' | 'bad'
  deltaLabel?: string | null
  variant?: 'default' | 'late'
  tooltipTerm?: string
  className?: string
}

export default function ContagemKpi({
  value, total, label,
  delta = null,
  variant = 'default',
  deltaVariant = 'neutral',
  deltaLabel = null,
  tooltipTerm,
}: ContagemKpiProps) {
  const isLate = variant === 'late'
  return (
    <div className="contagem-kpi">
      <div className="contagem-kpi-numbers">
        <span className={`contagem-kpi-value t-headline t-tabular${isLate ? ' late' : ''}`}>{value}</span>
        <span className="contagem-kpi-denom">/ {total}</span>
      </div>
      {tooltipTerm ? (
        <TermTooltip term={tooltipTerm}>
          <div className="contagem-kpi-label">{label}</div>
        </TermTooltip>
      ) : (
        <div className="contagem-kpi-label">{label}</div>
      )}
      {delta !== null && (
        <div className={`contagem-kpi-delta ${deltaVariant}`}>
          {delta >= 0 ? '+' : ''}{delta} {deltaLabel ?? 'últimos 7 dias'}
        </div>
      )}
    </div>
  )
}
