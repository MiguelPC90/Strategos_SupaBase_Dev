// color: 'navy' | 'green' | 'blue' | 'red' | 'amber'
export default function ProgressBar({ value = 0, color = 'navy', showLabel = true }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="progress-wrap">
      <div className="progress-track">
        <div
          className={`progress-fill ${color !== 'navy' ? color : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="progress-pct">{pct}%</span>}
    </div>
  )
}
