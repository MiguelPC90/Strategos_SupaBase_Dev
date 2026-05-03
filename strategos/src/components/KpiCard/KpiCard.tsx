import './KpiCard.css'
import { type ReactNode } from 'react'

type KpiColor = 'navy' | 'green' | 'blue' | 'red' | 'amber' | 'text'

interface KpiCardProps {
  label: string
  value?: ReactNode
  subtitle?: string
  /** Optional trend indicator rendered below the value (e.g. "▲ 2.3%"). */
  trend?: ReactNode
  color?: KpiColor
}

const colorMap: Record<KpiColor, string> = {
  navy:  'var(--navy)',
  green: 'var(--green)',
  blue:  'var(--blue)',
  red:   'var(--red)',
  amber: 'var(--amber)',
  text:  'var(--text)',
}

export default function KpiCard({ label, value, subtitle, trend, color = 'text' }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value t-title" style={{ color: colorMap[color] }}>
        {value ?? '—'}
      </span>
      {trend !== undefined && <span className="kpi-trend">{trend}</span>}
      {subtitle && <span className="kpi-subtitle">{subtitle}</span>}
    </div>
  )
}
