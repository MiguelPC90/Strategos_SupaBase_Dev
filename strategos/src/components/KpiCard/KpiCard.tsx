import './KpiCard.css'
import { type ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

type KpiColor = 'navy' | 'green' | 'blue' | 'red' | 'amber' | 'text'

interface KpiCardProps {
  label: string
  value?: ReactNode
  subtitle?: string
  /** Optional trend indicator rendered below the value (e.g. "▲ 2.3%"). */
  trend?: ReactNode
  color?: KpiColor
  /** 'compact' keeps the existing layout; 'hero' uses a serif headline + delta chip. */
  variant?: 'compact' | 'hero'
  /** Raw numeric delta — positive = up, negative = down. If omitted, no chip is shown. */
  delta?: number | null
  /** 'positive' means up is good (green chip), 'negative' means up is bad (red chip). */
  deltaVariant?: 'positive' | 'negative'
  /** Suffix appended to the delta number in the chip (e.g. "pp", " actividades"). */
  deltaSuffix?: string
}

const colorMap: Record<KpiColor, string> = {
  navy:  'var(--navy)',
  green: 'var(--green)',
  blue:  'var(--blue)',
  red:   'var(--red)',
  amber: 'var(--amber)',
  text:  'var(--text)',
}

function fmtDelta(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

function deltaChipClass(d: number, v: 'positive' | 'negative'): string {
  if (d === 0) return 'kpi-chip kpi-chip-neutral'
  const good = v === 'positive' ? d > 0 : d < 0
  return `kpi-chip ${good ? 'kpi-chip-good' : 'kpi-chip-bad'}`
}

export default function KpiCard({
  label,
  value,
  subtitle,
  trend,
  color = 'text',
  variant = 'compact',
  delta = null,
  deltaVariant = 'positive',
  deltaSuffix = '',
}: KpiCardProps) {
  if (variant === 'hero') {
    const hasDelta = delta !== null
    const sign = hasDelta && delta! > 0 ? '+' : ''
    return (
      <div className="kpi-card kpi-card-hero">
        <span className="kpi-label t-label">{label}</span>
        <div className="kpi-value-row">
          <span className="kpi-value-hero t-headline-sm t-tabular" style={{ color: colorMap[color] }}>
            {value ?? '—'}
          </span>
          {hasDelta && (
            <span className={deltaChipClass(delta!, deltaVariant)}>
              {delta! > 0
                ? <TrendingUp size={11} strokeWidth={2} />
                : delta! < 0
                  ? <TrendingDown size={11} strokeWidth={2} />
                  : null}
              {sign}{fmtDelta(delta!)}{deltaSuffix}
            </span>
          )}
        </div>
        {subtitle && <span className="kpi-subtitle">{subtitle}</span>}
      </div>
    )
  }

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
