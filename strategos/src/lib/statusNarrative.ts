export interface NarrativeParams {
  status: string
  execMedia: number
  execTarget: number
  delayedCount: number
  riskCount?: number
  pdsAttentionCount?: number
  delayedDelta?: number
  riskDelta?: number
}

const FEM  = ['zero','uma','duas','três','quatro','cinco','seis','sete','oito','nove']
const MASC = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove']

function numWord(n: number, gender: 'f' | 'm'): string {
  if (n > 9) return String(n)
  return gender === 'f' ? FEM[n] : MASC[n]
}

export function generateStatusNarrative(p: NarrativeParams): string {
  const sentences: string[] = []

  const tracking = p.execMedia >= p.execTarget ? 'em linha com o' : 'aquém do'
  sentences.push(
    `${p.execMedia.toFixed(0)}% executado, ${tracking} objectivo de ${p.execTarget.toFixed(0)}%.`
  )

  const issues: string[] = []
  if (p.delayedCount > 0) {
    const w = p.delayedCount === 1 ? 'actividade em atraso' : 'actividades em atraso'
    issues.push(`${numWord(p.delayedCount, 'f')} ${w}`)
  }
  if ((p.riskCount ?? 0) > 0) {
    const rc = p.riskCount!
    const w  = rc === 1 ? 'risco crítico' : 'riscos críticos'
    issues.push(`${numWord(rc, 'm')} ${w}`)
  }
  if (issues.length > 0) {
    sentences.push(issues.join('; ') + '.')
  }

  if ((p.delayedDelta ?? 0) > 0) {
    const n = p.delayedDelta!
    sentences.push(`${n} novo${n > 1 ? 's' : ''} atraso${n > 1 ? 's' : ''} neste ciclo.`)
  }
  if ((p.riskDelta ?? 0) > 0) {
    const n = p.riskDelta!
    sentences.push(`${n} risco${n > 1 ? 's' : ''} escalado${n > 1 ? 's' : ''} neste ciclo.`)
  }

  return sentences.join(' ')
}
