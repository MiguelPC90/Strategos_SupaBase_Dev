import { type ReactNode } from 'react'

type KpiColor = 'navy' | 'green' | 'blue' | 'red' | 'amber' | 'text'

interface KpiCardProps {
  label: string
  value?: ReactNode
  subtitle?: string
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

export default function KpiCard({ label, value, subtitle, color = 'text' }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" style={{ color: colorMap[color] }}>
        {value ?? '—'}
      </span>
      {subtitle && <span className="kpi-subtitle">{subtitle}</span>}
    </div>
  )
}
