export interface GradeStyle {
  bg:     string
  color:  string
  border: string
}

export interface RiskThresholds {
  very_low: number
  low:      number
  medium:   number
  high:     number
}

export const DEFAULT_THRESHOLDS: RiskThresholds = {
  very_low: 5,
  low:      9,
  medium:   12,
  high:     17,
}

export function gradeStyle(
  grade: number,
  _size: number,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS,
): GradeStyle {
  if (grade <= thresholds.very_low) return { bg: '#4a9e3f', color: '#fff',    border: '#3d8534' }
  if (grade <= thresholds.low)      return { bg: '#8cc63f', color: '#1a1a18', border: '#7ab535' }
  if (grade <= thresholds.medium)   return { bg: '#f5c542', color: '#1a1a18', border: '#e0b23a' }
  if (grade <= thresholds.high)     return { bg: '#f5943a', color: '#fff',    border: '#e0842e' }
  return                                   { bg: '#e85c4a', color: '#fff',    border: '#d44a38' }
}

export function gradeLabel(
  grade: number,
  _size: number,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS,
): string {
  if (grade <= thresholds.very_low) return 'Muito Baixo'
  if (grade <= thresholds.low)      return 'Baixo'
  if (grade <= thresholds.medium)   return 'Médio'
  if (grade <= thresholds.high)     return 'Alto'
  return 'Crítico'
}
