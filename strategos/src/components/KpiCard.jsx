// color: 'navy' | 'green' | 'blue' | 'red' | 'amber'
export default function KpiCard({ label, value, subtitle, color = 'navy' }) {
  const accentColors = {
    navy:  'var(--navy)',
    green: 'var(--green)',
    blue:  'var(--blue)',
    red:   'var(--red)',
    amber: 'var(--amber)',
  }

  return (
    <div className="kpi-card" style={{ borderLeft: `3px solid ${accentColors[color] ?? accentColors.navy}` }}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" style={{ color: accentColors[color] ?? accentColors.navy }}>
        {value ?? '—'}
      </span>
      {subtitle && <span className="kpi-subtitle">{subtitle}</span>}
    </div>
  )
}
