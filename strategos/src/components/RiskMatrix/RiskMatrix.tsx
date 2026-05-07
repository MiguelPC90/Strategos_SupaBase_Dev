import './RiskMatrix.css'
import { useMemo } from 'react'
import { gradeStyle, DEFAULT_THRESHOLDS, type RiskThresholds } from '../../lib/riskColors'
import type { Risk } from '../../types/index'

interface RiskMatrixProps {
  risks: Risk[]
  size: number
  thresholds?: RiskThresholds
  compact?: boolean
  showAxisLabels?: boolean
}

export default function RiskMatrix({
  risks,
  size,
  thresholds = DEFAULT_THRESHOLDS,
  compact = false,
  showAxisLabels = true,
}: RiskMatrixProps) {
  const cellSize = compact ? 28 : 36
  const gridTemplate = `repeat(${size}, ${cellSize}px)`

  const cellMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of risks) {
      const k = `${r.impact},${r.probability}`
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return map
  }, [risks])

  const cells = useMemo(() => {
    const result = []
    for (let prob = size; prob >= 1; prob--) {
      for (let impact = 1; impact <= size; impact++) {
        const grade = impact * prob
        const gs = gradeStyle(grade, size, thresholds)
        const count = cellMap.get(`${impact},${prob}`) ?? 0
        result.push(
          <div
            key={`c${impact}${prob}`}
            className={`rm-cell${count > 0 ? ' has-risks' : ''}`}
            style={{ background: gs.bg, border: `1px solid ${gs.border}` }}
            title={count > 0 ? `${count} risco${count !== 1 ? 's' : ''} (I:${impact} × P:${prob})` : undefined}
          >
            {count > 0 && <span className="rm-dot">{count > 1 ? String(count) : ''}</span>}
          </div>
        )
      }
    }
    return result
  }, [cellMap, size, thresholds])

  if (!showAxisLabels) {
    return (
      <div className={`rm-wrap${compact ? ' compact' : ''}`}>
        <div
          className="rm-matrix"
          style={{ gridTemplateColumns: gridTemplate, gridTemplateRows: gridTemplate }}
        >
          {cells}
        </div>
      </div>
    )
  }

  return (
    <div className={`rm-wrap${compact ? ' compact' : ''}`}>
      <div className="rm-body">
        <span className="rm-axis-label rm-axis-y">PROBABILIDADE</span>
        <div className="rm-right">
          <div className="rm-matrix-row">
            <div className="rm-y-col">
              {Array.from({ length: size }, (_, i) => (
                <span key={i} className="rm-axis-num">{size - i}</span>
              ))}
            </div>
            <div
              className="rm-matrix"
              style={{ gridTemplateColumns: gridTemplate, gridTemplateRows: gridTemplate }}
            >
              {cells}
            </div>
          </div>
          <div className="rm-x-row">
            <div className="rm-x-spacer" />
            <div className="rm-x-nums" style={{ gridTemplateColumns: gridTemplate }}>
              {Array.from({ length: size }, (_, i) => (
                <span key={i} className="rm-axis-num rm-axis-x">{i + 1}</span>
              ))}
            </div>
          </div>
          <span className="rm-axis-label rm-axis-bottom">IMPACTO</span>
        </div>
      </div>
    </div>
  )
}
