// color: 'navy' | 'green' | 'blue' | 'red' | 'amber' | 'text'
export default function KpiCard({ label, value, subtitle, color = 'text' }) {
  const colorMap = {
    navy:  'var(--navy)',
    green: 'var(--green)',
    blue:  'var(--blue)',
    red:   'var(--red)',
    amber: 'var(--amber)',
    text:  'var(--text)',
  }

  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" style={{ color: colorMap[color] ?? colorMap.text }}>
        {value ?? '—'}
      </span>
      {subtitle && <span className="kpi-subtitle">{subtitle}</span>}
    </div>
  )
}
