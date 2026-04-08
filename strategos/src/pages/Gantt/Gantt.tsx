import Card from '../../components/Card/Card'

export default function Gantt() {
  return (
    <Card title="Diagrama de Gantt">
      <div className="page-placeholder">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--text3)" strokeWidth="1.5">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="15" y2="12" />
          <line x1="3" y1="18" x2="18" y2="18" />
        </svg>
        <h2>Gantt</h2>
        <p>Diagrama de Gantt — a implementar</p>
      </div>
    </Card>
  )
}
