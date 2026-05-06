import './SmartKpi.css'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface SmartKpiProps {
  label: string
  value: number | null
  delta?: number | null
  target?: number | null
  className?: string
}

export default function SmartKpi({ label, value, delta = null, target = null }: SmartKpiProps) {
  const abs = delta !== null ? Math.abs(delta) : 0
  const cls = delta === null || abs < 0.05 ? 'neutral' : delta > 0 ? 'positive' : 'negative'
  return (
    <div className="executive-kpi">
      <div className="executive-kpi-label t-label">{label}</div>
      <div className="executive-kpi-value-row">
        <span className="executive-kpi-value t-headline t-tabular">
          {value !== null ? `${value.toFixed(1)}%` : '—'}
        </span>
        {delta !== null && abs >= 0.05 && (
          <span className={`executive-kpi-delta ${cls}`}>
            {delta > 0
              ? <TrendingUp size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} />
              : <TrendingDown size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle' }} />}
            {abs.toFixed(1)}pp
          </span>
        )}
      </div>
      {target !== null && (
        <div className="executive-kpi-target">Objectivo: {target.toFixed(1)}%</div>
      )}
    </div>
  )
}
