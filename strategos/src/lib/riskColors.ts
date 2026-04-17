export interface GradeStyle {
  bg:     string
  color:  string
  border: string
}

export function gradeStyle(grade: number, size: number): GradeStyle {
  const pct = grade / (size * size)
  if (pct <= 0.2)  return { bg: '#4a9e3f', color: '#fff',    border: '#3d8534' }
  if (pct <= 0.35) return { bg: '#8cc63f', color: '#1a1a18', border: '#7ab535' }
  if (pct <= 0.5)  return { bg: '#f5c542', color: '#1a1a18', border: '#e0b23a' }
  if (pct <= 0.7)  return { bg: '#f5943a', color: '#fff',    border: '#e0842e' }
  return                  { bg: '#e85c4a', color: '#fff',    border: '#d44a38' }
}

export function gradeLabel(grade: number, size: number): string {
  const pct = grade / (size * size)
  if (pct <= 0.2)  return 'Muito Baixo'
  if (pct <= 0.35) return 'Baixo'
  if (pct <= 0.5)  return 'Médio'
  if (pct <= 0.7)  return 'Alto'
  return 'Crítico'
}
