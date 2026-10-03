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
  | 'sem_baseline'
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

export interface TrendPeriod {
  /** Option label in Admin → Tendência. */
  label: string
  days: number
  /** How the sentence phrases this window. */
  phrase: string
}

/**
 * The named comparison windows. Admin → Tendência offers exactly these (plus
 * "Outro"), and the sentence phrases them from this same table, so the label an
 * administrator picks and the words printed can never disagree.
 */
export const TREND_PERIODS: readonly TrendPeriod[] = [
  { label: 'Semana',    days: 7,   phrase: 'na última semana'    },
  { label: 'Quinzena',  days: 15,  phrase: 'na última quinzena'  },
  { label: 'Mês',       days: 30,  phrase: 'no último mês'       },
  { label: 'Trimestre', days: 90,  phrase: 'no último trimestre' },
  { label: 'Semestre',  days: 180, phrase: 'no último semestre'  },
]

/**
 * Shortest comparison window. Snapshots are daily, so anything under a week would
 * compare with yesterday — and "nos últimos 1 dias" is not Portuguese. Admin
 * rejects shorter "Outro" values; a shorter value already stored is read as this.
 */
export const MIN_TREND_WINDOW_DAYS = 7

/** The window actually used: the configured one, floored at a week. */
export function effectiveWindowDays(windowDays: number): number {
  return Math.max(MIN_TREND_WINDOW_DAYS, windowDays)
}

/**
 * Phrases the comparison window. Exact match only: any length that is not a named
 * period is stated literally, so a 45-day window never reads "no último mês".
 */
export function windowPhrase(windowDays: number): string {
  const days  = effectiveWindowDays(windowDays)
  const named = TREND_PERIODS.find(t => t.days === days)
  return named ? named.phrase : `nos últimos ${days} dias`
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
  // 1 — concluded. FIRST, regardless of baseline: a plano that is 100% done but
  // whose leaves carry no baseline dates must never read "não iniciado".
  if (p.status === 'Concluída') return 'concluido'
  // 2 — no baseline to measure against: execTarget <= 0 means no leaf has usable
  // baseline dates, or none has reached its baseline start (also the degenerate case
  // that used to read "0% executado, em linha com o objectivo de 0%"). Splits on
  // execution: none → não iniciado; some (work started ahead of the baseline) →
  // sem baseline. Zero execution with a live target does NOT land here: that plano
  // should have started, and family 5's "0% executado contra 30% previsto" says so.
  if (p.execTarget <= 0) return p.execMedia > 0 ? 'sem_baseline' : 'nao_iniciado'
  // 3 / 4 — deadline already passed; which family depends on whether it fell
  // before the comparison window opened or inside it.
  if (p.deadline && p.deadline < p.today) {
    const windowStart = addDays(p.today, -effectiveWindowDays(p.windowDays))
    return p.deadline < windowStart ? 'fora_de_prazo' : 'ultrapassou_prazo'
  }
  // 5 — in progress, within the deadline
  return 'em_curso'
}

/**
 * The trend clause. Judgement comes from how the GAP (planned − actual) moved
 * across the window; raw progress is always reported alongside as context.
 * Every gap change splits by whether the plano advanced or stalled; stable also
 * splits by plan state instead of a new threshold: the state already grades the
 * gap's size through the aggregates band, and only Em dia / Em risco / Em atraso
 * reach family 5 (expired deadlines go to 3/4), so that split is total.
 *
 * "Stalled" is one definition for all rows: progress <= stabilityPoints (the
 * Admin stability threshold). It is one-sided on purpose — execution revised
 * DOWNWARD counts as stalled — so a negative progress value is never printed.
 *
 * MOVED BASELINE — deliberately NOT detected (out of scope): the gap can narrow
 * with no work done when the deadline is extended or scope is added, since both
 * lower today's planned %. It would be detectable — the stored planned %
 * (exec_media_prev in the snapshots) DROPS between the two dates, where it
 * normally only rises — but that check was left out on purpose. This is why the
 * narrowed-while-stalled row carries no judgement word: it states both facts and
 * lets "embora" carry the oddity.
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
  const stalled  = progress <= p.stabilityPoints

  if (widened) {
    return stalled
      ? `Tendência desfavorável: praticamente sem avanço ${when}, com o desvio a subir de ${fmtNum(gapPrev)} para ${fmtPoints(gapNow)}.`
      : `Tendência desfavorável: avançou ${fmtPoints(progress)} ${when}, mas o desvio agravou-se de ${fmtNum(gapPrev)} para ${fmtPoints(gapNow)}.`
  }
  if (narrowed) {
    return stalled
      ? `Sem avanços ${when}, embora o desvio se tenha reduzido de ${fmtNum(gapPrev)} para ${fmtPoints(gapNow)}.`
      : `Tendência favorável: avançou ${fmtPoints(progress)} ${when} e o desvio reduziu-se de ${fmtNum(gapPrev)} para ${fmtPoints(gapNow)}.`
  }
  // Stable. "Sem recuperação" states the gap's current level, not a from-to:
  // nothing moved, so the level is what matters. Its stalled row says "execução
  // inalterada" to avoid a second "sem".
  if (p.status === 'Em dia') {
    return stalled
      ? `Mantém o ritmo previsto: sem avanço material ${when}, com o desvio praticamente inalterado.`
      : `Mantém o ritmo previsto: avançou ${fmtPoints(progress)} ${when}, com o desvio praticamente inalterado.`
  }
  return stalled
    ? `Sem recuperação: execução inalterada ${when}, com o desvio em ${fmtPoints(gapNow)}.`
    : `Sem recuperação: avançou ${fmtPoints(progress)} ${when}, mas o desvio mantém-se em ${fmtPoints(gapNow)}.`
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

  if (family === 'sem_baseline') {
    // "Em execução" describes activity; it is not one of the four plan states.
    return `Em execução (${fmtPct(p.execMedia)}), sem baseline para comparação.`
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
    // Floored at 0: a downward revision is never printed as "avançou -…".
    const progress = Math.max(0, p.execMedia - p.trend.prevExec)
    return `${head} e avançou ${fmtPoints(progress)} ${windowPhrase(p.windowDays)}.`
  }

  if (family === 'ultrapassou_prazo') {
    const head = `Ultrapassou o prazo em ${fmtMonthYear(p.deadline!)} com ${fmtPct(remaining)} por executar`
    if (!p.trend) return `${head}.`
    const progress = Math.max(0, p.execMedia - p.trend.prevExec)
    return `${head}; avançou apenas ${fmtPoints(progress)} ${windowPhrase(p.windowDays)}.`
  }

  // family === 'em_curso'
  const enumeration = enumerationClause(p)
  const first = enumeration
    ? `${fmtPct(p.execMedia)} executado contra ${fmtPct(p.execTarget)} previsto, com ${enumeration}.`
    : `${fmtPct(p.execMedia)} executado contra ${fmtPct(p.execTarget)} previsto.`

  return trend ? `${first} ${trend}` : first
}
