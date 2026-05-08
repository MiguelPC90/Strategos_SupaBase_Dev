import './InteractiveRiskMatrix.css'
import { useMemo, type ReactNode } from 'react'
import type { Risk } from '../../types/index'
import { gradeStyle, type RiskThresholds } from '../../lib/riskColors'

interface InteractiveRiskMatrixProps {
  risks: Risk[]
  size: number
  thresholds: RiskThresholds
  selectedIds: string[]
  onSelect: (ids: string[]) => void
}

export default function InteractiveRiskMatrix({ risks, size, thresholds, selectedIds, onSelect }: InteractiveRiskMatrixProps) {
  const cellMap = useMemo(() => {
    const map = new Map<string, Risk[]>()
    for (const r of risks) {
      const k = `${r.impact},${r.probability}`
      map.set(k, [...(map.get(k) ?? []), r])
    }
    return map
  }, [risks])

  const cells: ReactNode[] = []
  const yNums: ReactNode[] = []

  for (let prob = size; prob >= 1; prob--) {
    yNums.push(<span key={`y${prob}`} className="irm-axis-num">{prob}</span>)
    for (let impact = 1; impact <= size; impact++) {
      const grade = impact * prob
      const gs    = gradeStyle(grade, size, thresholds)
      const k     = `${impact},${prob}`
      const cellRisks = cellMap.get(k) ?? []
      const sel   = cellRisks.some(r => selectedIds.includes(r.id))
      cells.push(
        <div
          key={`c${impact}${prob}`}
          className={`irm-cell${cellRisks.length ? ' has-risks' : ''}${sel ? ' selected' : ''}`}
          style={{ background: gs.bg, border: `1px solid ${gs.border}` }}
          onClick={() => onSelect(cellRisks.length ? cellRisks.map(r => r.id) : [])}
          title={cellRisks.map(r => r.description).join('\n')}
        >
          {cellRisks.length > 0 && (
            <span className={`irm-dot${sel ? ' selected' : ''}`}>
              {cellRisks.length > 1 ? String(cellRisks.length) : ''}
            </span>
          )}
        </div>
      )
    }
  }

  const gridCols = `repeat(${size}, 1fr)`

  return (
    <div className="irm-wrap">
      <div className="irm-label">Matriz de Risco</div>
      <div className="irm-body">
        <span className="irm-axis-label irm-axis-y">PROBABILIDADE</span>
        <div className="irm-right">
          <div className="irm-row">
            <div className="irm-y-col">{yNums}</div>
            <div className="irm-grid" style={{ gridTemplateColumns: gridCols, gridTemplateRows: gridCols }}>
              {cells}
            </div>
          </div>
          <div className="irm-x-row">
            <div className="irm-x-spacer" />
            <div className="irm-x-nums" style={{ gridTemplateColumns: gridCols }}>
              {Array.from({ length: size }, (_, i) => (
                <span key={i} className="irm-axis-num irm-axis-x">{i + 1}</span>
              ))}
            </div>
          </div>
          <span className="irm-axis-label irm-axis-bottom">IMPACTO</span>
        </div>
      </div>
    </div>
  )
}
