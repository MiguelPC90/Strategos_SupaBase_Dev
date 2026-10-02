// ── Plan status narrative ──────────────────────────────────────
// The one-line synthesis under the plan header, shared by PlanoPage and
// PontoSituacao. Its job is to say what the cards below do NOT already show, for
// an administrator who does not follow the projects daily.
//
// Design rules:
//  - Percentages are TRUNCATED to one decimal, never rounded up, so "100%" only
//    appears when the value genuinely reached 100.
//  - A DIFFERENCE between two percentages is reported in "pontos", spelled out.
//  - The sentence NEVER names the plan state (Em dia / Em risco / Em atraso /
//    Concluída): the Estado pill sits directly above it. The state SELECTS the
//    family; it is not repeated in the text.

export type NarrativeFamily =
  | 'nao_iniciado'
  | 'concluido'
  | 'fora_de_prazo'
  | 'ultrapassou_prazo'
  | 'em_curso'

/** Comparison point taken from snapshot history (see lib/narrativeTrend.ts). */
export interface TrendInput {
  /** Execution % (0-100) at the comparison snapshot. */
  prevExec: number
  /** Gap (planned − actual, in points) at the comparison snapshot. */
  prevGap: number
}

export interface NarrativeParams {
  /** Plan state — selects the family, never named in the output. */
  status: string
  /** Raw, unrounded averages (0-100). Never pass pre-rounded values. */
  execMedia: number
  execTarget: number
  /** Leaf counts by effective status. */
  riskCount: number
  delayedCount: number
  concludedCount: number
  /** Risks graded critical (impact * probability > thresholds.high). */
  criticalRisks: number
  /** Latest baseline finish across the leaves — the deadline. ISO date or null. */
  deadline: string | null
  /** Latest real finish across the leaves — used by the concluded family. */
  realFinish: string | null
  /** ISO date used as "today". */
  today: string
  /** Null when history does not reach back a full window: then no trend clause. */
  trend: TrendInput | null
  /** app_config: narrative_trend_window_days (default 30). */
  windowDays: number
  /** app_config: narrative_trend_stability_points (default 1). */
  stabilityPoints: number
}

const FEM  = ['zero','uma','duas','três','quatro','cinco','seis','sete','oito','nove']
const MASC = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove']

const PT_MONTHS_LONG = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

/** Spells 0-9 in words; 10+ stays numeric. */
export function numWord(n: number, gender: 'f' | 'm'): string {
  if (n > 9) return String(n)
  return gender === 'f' ? FEM[n] : MASC[n]
}

/**
 * Truncates to one decimal (never rounds up) and formats PT-PT. 100 stays "100".
 *
 * Float noise is absorbed first: 75 - 68.2 is 6.799999999999997 in IEEE754, and
 * truncating that naively would print "6,7" for a value that is mathematically 6.8.
 * Rounding to 6 decimals only ever promotes values within 5e-7 of the next tenth —
 * i.e. pure representation error — so the truncation intent is preserved (99.98 and
 * 99.99999 both stay 99,9).
 */
export function fmtNum(v: number): string {
  const clean = Math.round(Math.abs(v) * 1e6) / 1e6
  const t = Math.trunc(clean * 10) / 10
  const s = v < 0 ? -t : t
  return Number.isInteger(s) ? String(s) : String(s).replace('.', ',')
}

/** Truncated percentage: 99.98 → "99,9%"; 100 → "100%"; 75 → "75%". */
export function fmtPct(v: number): string {
  return `${fmtNum(v)}%`
}

/** A difference between percentages, in spelled-out points. */
function fmtPoints(v: number): string {
  const n = fmtNum(v)
  return `${n} ${n === '1' ? 'ponto' : 'pontos'}`
}

/** "2026-09-14" → "Setembro de 2026". */
function fmtMonthYear(iso: string): string {
  const [y, m] = iso.split('-')
  return `${PT_MONTHS_LONG[parseInt(m, 10) - 1]} de ${y}`
}

/** Phrases the comparison window from its configured length in days. */
export function windowPhrase(windowDays: number): string {
  if (windowDays <= 10)  return 'na última semana'
  if (windowDays <= 45)  return 'no último mês'
  if (windowDays <= 120) return 'no último trimestre'
  return `nos últimos ${windowDays} dias`
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Whole months from `today` to `deadline`, floored. Negative when past. */
function monthsUntil(today: string, deadline: string): number {
  const a = new Date(`${today}T00:00:00Z`)
  const b = new Date(`${deadline}T00:00:00Z`)
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
  if (b.getUTCDate() < a.getUTCDate()) months -= 1
  return months
}

export function selectFamily(p: NarrativeParams): NarrativeFamily {
  // 1 — nothing executed, or no baseline to measure against (execTarget === 0 is
  // the degenerate case that used to read "0% executado, em linha com o objectivo de 0%").
  if (p.execTarget <= 0 || p.execMedia <= 0) return 'nao_iniciado'
  // 2 — concluded
  if (p.status === 'Concluída') return 'concluido'
  // 3 / 4 — deadline already passed; which family depends on whether it fell
  // before the comparison window opened or inside it.
  if (p.deadline && p.deadline < p.today) {
    const windowStart = addDays(p.today, -p.windowDays)
    return p.deadline < windowStart ? 'fora_de_prazo' : 'ultrapassou_prazo'
  }
  // 5 — in progress, within the deadline
  return 'em_curso'
}

/**
 * The trend clause. Judgement comes from how the GAP (planned − actual) moved
 * across the window; raw progress is always reported alongside as context.
 *
 * KNOWN LIMITATION (accepted, out of scope): extending a plano's deadline lowers
 * today's planned %, so the gap narrows with no work done and this reads
 * "Tendência favorável". Detecting that would require comparing baselines across
 * snapshots too.
 */
function trendClause(p: NarrativeParams): string {
  if (!p.trend) return ''
  const when     = windowPhrase(p.windowDays)
  const gapNow   = p.execTarget - p.execMedia
  const gapPrev  = p.trend.prevGap
  const gapDelta = gapNow - gapPrev
  const progress = p.execMedia - p.trend.prevExec

  const widened  = gapDelta >  p.stabilityPoints
  const narrowed = gapDelta < -p.stabilityPoints
  const stalled  = Math.abs(progress) <= p.stabilityPoints

  if (widened) {
    return stalled
      ? `Tendência desfavorável: praticamente sem avanço ${when}, com o desvio a subir de ${fmtNum(gapPrev)} para ${fmtPoints(gapNow)}.`
      : `Tendência desfavorável: avançou ${fmtPoints(progress)} ${when}, mas o desvio agravou-se de ${fmtNum(gapPrev)} para ${fmtPoints(gapNow)}.`
  }
  if (narrowed) {
    return stalled
      ? `Tendência favorável: praticamente sem avanço ${when}, mas o desvio reduziu-se de ${fmtNum(gapPrev)} para ${fmtPoints(gapNow)}.`
      : `Tendência favorável: avançou ${fmtPoints(progress)} ${when} e o desvio reduziu-se de ${fmtNum(gapPrev)} para ${fmtPoints(gapNow)}.`
  }
  return stalled
    ? `Tendência estável: sem avanço material ${when} e desvio inalterado.`
    : `Tendência estável: avançou ${fmtPoints(progress)} ${when}, com o desvio praticamente inalterado.`
}

/** Clause 2 of family 5: em risco → em atraso → riscos críticos → prazo. */
function enumerationClause(p: NarrativeParams): string {
  const activities: string[] = []
  if (p.riskCount > 0) {
    activities.push(`${numWord(p.riskCount, 'f')} ${p.riskCount === 1 ? 'actividade' : 'actividades'} em risco`)
  }
  if (p.delayedCount > 0) {
    // The noun is carried by the first activity item only: "cinco actividades em
    // risco e duas em atraso", but "duas actividades em atraso" when alone.
    const noun = activities.length > 0
      ? ''
      : ` ${p.delayedCount === 1 ? 'actividade' : 'actividades'}`
    activities.push(`${numWord(p.delayedCount, 'f')}${noun} em atraso`)
  }

  const groups: string[] = []
  if (activities.length > 0) groups.push(activities.join(' e '))
  if (p.criticalRisks > 0) {
    groups.push(`${numWord(p.criticalRisks, 'm')} ${p.criticalRisks === 1 ? 'risco crítico' : 'riscos críticos'}`)
  }
  if (p.deadline && p.deadline >= p.today) {
    const m = monthsUntil(p.today, p.deadline)
    if (m > 0) groups.push(`${numWord(m, 'm')} ${m === 1 ? 'mês' : 'meses'} até ao prazo`)
  }

  if (groups.length === 0) return ''
  if (groups.length === 1) return groups[0]
  return `${groups.slice(0, -1).join(', ')} e ${groups[groups.length - 1]}`
}

export function generateStatusNarrative(p: NarrativeParams): string {
  const family = selectFamily(p)

  if (family === 'nao_iniciado') {
    return 'Plano ainda não iniciado.'
  }

  if (family === 'concluido') {
    const n = `${numWord(p.concludedCount, 'f')} ${p.concludedCount === 1 ? 'actividade fechada' : 'actividades fechadas'}`
    return p.realFinish
      ? `Concluído em ${fmtMonthYear(p.realFinish)}, com ${n}.`
      : `Plano concluído, com ${n}.`
  }

  const remaining = Math.max(0, 100 - p.execMedia)
  const trend     = trendClause(p)

  if (family === 'fora_de_prazo') {
    // Past the deadline the planned % is pinned at 100, so the gap can only
    // close: this family talks about work remaining and pace, never "agravou-se".
    const head = `Prazo terminou em ${fmtMonthYear(p.deadline!)}. Faltam ${fmtPct(remaining)} por executar`
    if (!p.trend) return `${head}.`
    const progress = p.execMedia - p.trend.prevExec
    return `${head} e avançou ${fmtPoints(progress)} ${windowPhrase(p.windowDays)}.`
  }

  if (family === 'ultrapassou_prazo') {
    const head = `Ultrapassou o prazo em ${fmtMonthYear(p.deadline!)} com ${fmtPct(remaining)} por executar`
    if (!p.trend) return `${head}.`
    const progress = p.execMedia - p.trend.prevExec
    return `${head}; avançou apenas ${fmtPoints(progress)} ${windowPhrase(p.windowDays)}.`
  }

  // family === 'em_curso'
  const enumeration = enumerationClause(p)
  const first = enumeration
    ? `${fmtPct(p.execMedia)} executado contra ${fmtPct(p.execTarget)} previsto, com ${enumeration}.`
    : `${fmtPct(p.execMedia)} executado contra ${fmtPct(p.execTarget)} previsto.`

  return trend ? `${first} ${trend}` : first
}
